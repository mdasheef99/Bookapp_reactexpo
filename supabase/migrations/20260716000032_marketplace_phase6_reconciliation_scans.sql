-- Phase 6 Unit 15B: detection-only inventory, request, evidence, and privacy scans.
BEGIN;
CREATE FUNCTION marketplace_sec.reconcile_phase6_core(p_correlation_id UUID)
RETURNS INTEGER LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $$ DECLARE v RECORD;v_count INTEGER:=0;v_category TEXT;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED';END IF;

 FOR v IN WITH hold_totals AS(
  SELECT inventory_id,COALESCE(sum(quantity) FILTER(WHERE status='active'),0)::INTEGER active_qty
  FROM public.inventory_holds GROUP BY inventory_id)
 SELECT i.*,COALESCE(h.active_qty,0) active_qty FROM public.store_inventory i
 LEFT JOIN hold_totals h ON h.inventory_id=i.id
 WHERE i.quantity_reserved<>COALESCE(h.active_qty,0) OR i.quantity_total<>
  i.quantity_available+i.quantity_reserved+i.quantity_sold+i.quantity_removed
  OR LEAST(i.quantity_total,i.quantity_available,i.quantity_reserved,i.quantity_sold,i.quantity_removed)<0
 LOOP
  v_category:=CASE WHEN v.quantity_reserved>v.active_qty THEN 'reserved_greater_than_active_holds'
   WHEN v.quantity_reserved<v.active_qty THEN 'active_holds_greater_than_reserved'
   WHEN LEAST(v.quantity_total,v.quantity_available,v.quantity_reserved,v.quantity_sold,v.quantity_removed)<0
    THEN 'negative_inventory_counter' ELSE 'inventory_bucket_total_inconsistent' END;
  PERFORM marketplace_sec.record_phase6_reconciliation_case(v_category||':'||v.id,v_category,'critical',
   'store_inventory',v.id,v.store_id,jsonb_build_object('quantityTotal',v.quantity_total,
   'quantityAvailable',v.quantity_available,'quantityReserved',v.quantity_reserved,
   'quantitySold',v.quantity_sold,'quantityRemoved',v.quantity_removed,'activeHoldQuantity',v.active_qty),
   p_correlation_id);v_count:=v_count+1;
 END LOOP;

 FOR v IN SELECT r.id,r.store_id,r.status,h.id hold_id,h.hold_type FROM public.store_order_requests r
 JOIN public.inventory_holds h ON h.order_request_id=r.id AND h.status='active'
 WHERE r.status IN('unavailable','store_rejected','customer_cancelled','platform_cancelled','expired','payment_ready_expired')
 LOOP PERFORM marketplace_sec.record_phase6_reconciliation_case('terminal_request_active_hold:'||v.hold_id,
  'terminal_request_active_hold','critical','store_order_request',v.id,v.store_id,
  jsonb_build_object('requestStatus',v.status,'holdType',v.hold_type),p_correlation_id);v_count:=v_count+1;END LOOP;

 FOR v IN SELECT r.id,r.store_id,r.status FROM public.store_order_requests r WHERE
  (r.status='payment_ready' AND NOT EXISTS(SELECT 1 FROM public.inventory_holds h
   WHERE h.order_request_id=r.id AND h.status='active' AND h.hold_type='firm')) OR
  (r.status='awaiting_customer_decision' AND NOT EXISTS(SELECT 1 FROM public.inventory_holds h
   WHERE h.order_request_id=r.id AND h.status='active' AND h.hold_type='soft'))
 LOOP v_category:=CASE v.status WHEN 'payment_ready' THEN 'payment_ready_missing_firm_hold'
   ELSE 'decision_state_missing_soft_hold' END;
  PERFORM marketplace_sec.record_phase6_reconciliation_case(v_category||':'||v.id,v_category,'critical',
   'store_order_request',v.id,v.store_id,jsonb_build_object('requestStatus',v.status),p_correlation_id);
  v_count:=v_count+1;END LOOP;

 FOR v IN SELECT r.id,r.store_id,r.status FROM public.store_order_requests r WHERE
  (r.status='awaiting_clarification' AND NOT EXISTS(SELECT 1 FROM public.store_order_request_items i
   WHERE i.order_request_id=r.id AND i.confirmation_status='needs_clarification')) OR
  (r.status IN('awaiting_customer_decision','payment_ready') AND NOT EXISTS(
   SELECT 1 FROM public.store_order_request_items i WHERE i.order_request_id=r.id
    AND i.confirmation_status IN('confirmed_full','confirmed_partial') AND i.confirmed_quantity>0)) OR
  (r.status='unavailable' AND EXISTS(SELECT 1 FROM public.store_order_request_items i
   WHERE i.order_request_id=r.id AND COALESCE(i.confirmed_quantity,0)>0)) OR
  (r.status='store_rejected' AND EXISTS(SELECT 1 FROM public.store_order_request_items i
   WHERE i.order_request_id=r.id AND i.confirmation_status NOT IN('rejected','unavailable')))
 LOOP PERFORM marketplace_sec.record_phase6_reconciliation_case('request_item_state_mismatch:'||v.id,
  'request_item_state_mismatch','critical','store_order_request',v.id,v.store_id,
  jsonb_build_object('requestStatus',v.status),p_correlation_id);v_count:=v_count+1;END LOOP;

 FOR v IN SELECT h.order_request_item_id,(array_agg(h.id ORDER BY h.id))[1] id,
  (array_agg(h.store_id ORDER BY h.store_id))[1] store_id,count(*) amount
  FROM public.inventory_holds h WHERE h.status='active' GROUP BY h.order_request_item_id HAVING count(*)>1
 LOOP PERFORM marketplace_sec.record_phase6_reconciliation_case('duplicate_active_hold:'||v.order_request_item_id,
  'duplicate_active_hold','critical','store_order_request_item',v.order_request_item_id,v.store_id,
  jsonb_build_object('activeHoldCount',v.amount),p_correlation_id);v_count:=v_count+1;END LOOP;

 FOR v IN SELECT t.id,t.entity_id,COALESCE(r.store_id,c.store_id) store_id
 FROM public.commerce_transition_log t
 LEFT JOIN public.marketplace_events e ON e.id=t.event_id AND e.command_id=t.command_id
 LEFT JOIN public.store_order_requests r ON t.entity_type='store_order_request' AND r.id=t.entity_id
 LEFT JOIN public.marketplace_carts c ON t.entity_type='marketplace_cart' AND c.id=t.entity_id
 WHERE e.id IS NULL
 LOOP PERFORM marketplace_sec.record_phase6_reconciliation_case('transition_missing_event:'||v.id,
  'transition_missing_event','critical','commerce_transition',v.id,v.store_id,'{}',p_correlation_id);
  v_count:=v_count+1;END LOOP;
 FOR v IN SELECT e.id,e.entity_id,e.store_id FROM public.marketplace_events e
 JOIN public.marketplace_event_schema_registry r ON r.event_type=e.event_type
  AND r.schema_version=e.schema_version AND r.is_transition=true
 LEFT JOIN public.commerce_transition_log t ON t.event_id=e.id
 WHERE t.id IS NULL
 LOOP PERFORM marketplace_sec.record_phase6_reconciliation_case('event_missing_transition:'||v.id,
  'event_missing_transition','critical','marketplace_event',v.id,v.store_id,'{}',p_correlation_id);
  v_count:=v_count+1;END LOOP;
 -- r.is_transition=false support/reminder/creation events intentionally require no transition row.
 FOR v IN SELECT t.id,t.entity_id,e.store_id FROM public.commerce_transition_log t
 JOIN public.marketplace_events e ON e.id=t.event_id WHERE e.command_id IS DISTINCT FROM t.command_id
  OR e.entity_id IS DISTINCT FROM t.entity_id
 LOOP PERFORM marketplace_sec.record_phase6_reconciliation_case('inconsistent_transition_event:'||v.id,
  'inconsistent_transition_event','critical','commerce_transition',v.id,v.store_id,'{}',p_correlation_id);
  v_count:=v_count+1;END LOOP;

 FOR v IN SELECT t.entity_id,(array_agg(t.id ORDER BY t.id))[1] id,
  (array_agg(COALESCE(r.store_id,c.store_id) ORDER BY COALESCE(r.store_id,c.store_id)))[1] store_id,
  count(*) amount FROM public.commerce_transition_log t
  LEFT JOIN public.store_order_requests r ON t.entity_type='store_order_request' AND r.id=t.entity_id
  LEFT JOIN public.marketplace_carts c ON t.entity_type='marketplace_cart' AND c.id=t.entity_id
  GROUP BY t.entity_type,t.entity_id,t.command_id,t.next_version HAVING count(*)>1
 LOOP PERFORM marketplace_sec.record_phase6_reconciliation_case('duplicate_transition_event:'||v.entity_id,
  'duplicate_transition_event','high','store_order_request',v.entity_id,v.store_id,
  jsonb_build_object('evidenceCount',v.amount),p_correlation_id);v_count:=v_count+1;END LOOP;
 FOR v IN SELECT r.id,r.store_id,r.version,COALESCE(max(t.next_version),1) evidence_version
  FROM public.store_order_requests r LEFT JOIN public.commerce_transition_log t
   ON t.entity_type='store_order_request' AND t.entity_id=r.id GROUP BY r.id,r.store_id,r.version
  HAVING r.version<>COALESCE(max(t.next_version),1)
 LOOP PERFORM marketplace_sec.record_phase6_reconciliation_case('request_version_evidence_mismatch:'||v.id,
  'request_version_evidence_mismatch','high','store_order_request',v.id,v.store_id,
  jsonb_build_object('requestVersion',v.version,'evidenceVersion',v.evidence_version),p_correlation_id);
  v_count:=v_count+1;END LOOP;

 FOR v IN SELECT r.id,r.store_id FROM public.store_order_requests r WHERE NOT EXISTS(
  SELECT 1 FROM public.commerce_entity_creation_log c WHERE c.entity_type='store_order_request' AND c.entity_id=r.id)
 LOOP PERFORM marketplace_sec.record_phase6_reconciliation_case('request_creation_evidence_missing:'||v.id,
  'request_creation_evidence_missing','critical','store_order_request',v.id,v.store_id,'{}',p_correlation_id);
  v_count:=v_count+1;END LOOP;
 FOR v IN SELECT c.id,c.store_id FROM public.marketplace_carts c WHERE c.status='submitted' AND NOT EXISTS(
  SELECT 1 FROM public.commerce_transition_log t WHERE t.entity_type='marketplace_cart' AND t.entity_id=c.id
   AND t.next_state='submitted')
 LOOP PERFORM marketplace_sec.record_phase6_reconciliation_case('cart_submission_evidence_missing:'||v.id,
  'cart_submission_evidence_missing','critical','marketplace_cart',v.id,v.store_id,'{}',p_correlation_id);
  v_count:=v_count+1;END LOOP;

 FOR v IN SELECT p.order_request_id id FROM public.store_order_request_private_snapshots p
  LEFT JOIN public.store_order_requests r ON r.id=p.order_request_id WHERE r.id IS NULL
 LOOP PERFORM marketplace_sec.record_phase6_reconciliation_case('orphaned_private_snapshot:'||v.id,
  'orphaned_private_snapshot','high','store_order_request',v.id,NULL,'{}',p_correlation_id);v_count:=v_count+1;END LOOP;
 FOR v IN SELECT i.id,i.store_id FROM public.store_order_request_items i
  LEFT JOIN public.store_order_requests r ON r.id=i.order_request_id WHERE r.id IS NULL
 LOOP PERFORM marketplace_sec.record_phase6_reconciliation_case('orphaned_request_item:'||v.id,
  'orphaned_request_item','high','store_order_request_item',v.id,v.store_id,'{}',p_correlation_id);v_count:=v_count+1;END LOOP;

 FOR v IN SELECT e.id,e.store_id FROM public.marketplace_events e WHERE e.event_type LIKE 'order_request.%'
  AND EXISTS(SELECT 1 FROM unnest(ARRAY['phone','address','email','contact','token','support_note']) key
   WHERE e.payload::TEXT ~* ('"'||key||'"[[:space:]]*:'))
 LOOP PERFORM marketplace_sec.record_phase6_reconciliation_case('prohibited_pii_payload:'||v.id,
  'prohibited_pii_payload','critical','marketplace_event',v.id,v.store_id,'{}',p_correlation_id);
  v_count:=v_count+1;END LOOP;
 FOR v IN SELECT n.id,n.store_id FROM public.marketplace_notifications n
  WHERE n.notification_type LIKE 'commerce.%' AND EXISTS(SELECT 1 FROM
   unnest(ARRAY['phone','address','email','contact','token','support_note']) key
   WHERE jsonb_build_object('title',n.title,'body',n.body)::TEXT ~* ('"'||key||'"[[:space:]]*:'))
 LOOP PERFORM marketplace_sec.record_phase6_reconciliation_case('prohibited_pii_payload:'||v.id,
  'prohibited_pii_payload','critical','marketplace_notification',v.id,v.store_id,'{}',p_correlation_id);
  v_count:=v_count+1;END LOOP;
 RETURN v_count;
END;$$;
REVOKE ALL ON FUNCTION marketplace_sec.reconcile_phase6_core(UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION marketplace_sec.reconcile_phase6_core(UUID) TO service_role;
COMMIT;
