# Phase 7/8: Cashfree Replies, Original Text

**Status:** the four replies from Cashfree (ticket 8774207), stored word for word on
2026-11-12. Each is exactly the text the owner pasted into the working session; nothing is
edited, shortened or corrected (R1 and R4 begin "ear Merchant" because the first letter was
lost when pasting).
**Authority:** this is the primary evidence. The [fact record](./PHASE-7-8-cashfree-replies.md)
turns it into numbered facts (CF-xx) with the tags R1 to R4 used below. If a fact and this
text ever disagree, this text wins and the fact is corrected.
**Times** are when the reply was pasted into the session, not when Cashfree sent it.
**Our mails:** [first](./PHASE-7-8-mail-cashfree.md) ·
[second](./PHASE-7-8-mail-cashfree-2.md) · [third](./PHASE-7-8-mail-cashfree-3.md)

| Tag | Reply | Sent by Cashfree (IST) | Signed | Pasted |
|---|---|---|---|---|
| R1 | Support reply to questions 1 to 20 (points 16 to 19 forwarded to the Tech Team) | 2026-11-10 2:00 PM | Amit Paul, Cashfree Care | 2026-11-10 11:29 UTC |
| R2 | Tech Team reply to points 16 to 19 | 2026-11-10 3:26 PM | Shreejoy Chatterjee, Integration Engineer | 2026-11-10 11:44 UTC |
| R3 | Tech Team reply to our second mail | 2026-11-10 7:14 PM | Shreejoy Chatterjee, Integration Engineer | 2026-11-10 16:55 UTC |
| R4 | Reply to our third mail | 2026-11-11 1:20 PM | Nikhil Scaria, Cashfree Care | 2026-11-11 10:21 UTC |

The whole Gmail thread (our mails as sent, the ticket acknowledgement and our 11 Nov
thank-you mail) is stored word for word in the [thread file](./PHASE-7-8-cashfree-thread-original.md).
Send times and signers above come from it (added 2026-11-12).

---

## R1: Support reply to questions 1 to 20 (points 16 to 19 forwarded to the Tech Team)

Pasted 2026-11-10 11:29 UTC.

```text
ear Merchant,

Greetings from Cashfree!

Thank you for reaching out to us.

We confirm that Easy Split has been successfully enabled for your account in the Test/Sandbox environment. You can now proceed with testing the integration.
Please find our responses to your queries below.
A. Easy Split and Deferred Settlements
1. Maximum Split Delay and Settlement Hold
Cashfree supports a maximum deferred settlement period of 45 days.
Please note the distinction between the split delay and deferred settlement configuration:
Order Split After Payment: The maximum configurable split delay is between 1 and 45 days in the supported configuration.
Deferred Settlement: The maximum deferral period can be configured up to 45 days.
Currently, your account has Split After Payment enabled with a default configuration of T+1, while deferred settlement is not yet enabled.

2. Setting or Updating the Settlement Eligibility Date for Each Order
Yes, Cashfree supports updating the settlement eligibility date for individual orders through an API.
You can use the following endpoint:
PUT /api/v2/easy-split/orders/{orderid}/settlement-eligibility/vendors/{vendorid}
The API supports the settlementEligibilityDateUpdate parameter, which allows you to update the settlement eligibility date for a particular vendor against an order.
Please refer to the Vendor-Level Deferred Settlement Documentation.
Important points:
The settlement eligibility date must fall within the configured maximum deferral window, calculated from the transaction date.
If the requested date exceeds the maximum eligible date, the API will return the error: Settlement eligibility cannot be beyond max_eligibility_date.
Once the maximum deferral window is reached, the held amount will be settled to your merchant account rather than remaining with the vendor.
3. Weekly Monday Settlements and Available Settlement Types
Currently, you cannot configure a recurring settlement schedule that automatically releases every vendor's balance exclusively on Mondays.
However, you can configure deferred settlement for individual vendors. Once the applicable deferral period is completed, the eligible amount will be automatically released for settlement.

As mentioned earlier, your current Split After Payment configuration is T+1, and we have requested deferred settlement enablement for 3 days. Please confirm what 
deferred settlement number has to be enabled.

The exact availability of Instant Settlement and On-Demand Settlement for your vendor settlement flow will need to be confirmed separately based on your account configuration.
Regarding the settlement timelines applicable under the RBI Payment Aggregator Directions, 2025, the product's 45-day deferral limit should not be treated as an unconditional extension of the statutory settlement requirements. The applicable compliance requirements will need to be considered for your specific marketplace arrangement.

4. Where Customer Funds Are Held and Whether Easy Split Supports Delivery Charges
Once customers make payments, the funds are maintained in Cashfree's escrow account and subsequently distributed according to the configured split and settlement arrangements.
Easy Split supports splitting a single customer payment between multiple vendors and your merchant account.
For your use case:
The respective store can receive its share.
BookConnect can retain its applicable platform or delivery-related share.
Alternatively, the delivery service provider can also be added as a separate vendor under Easy Split, provided the vendor completes the required onboarding and verification.
This would allow the delivery provider's share to be distributed directly through the configured split arrangement.
B. Store (Vendor) Onboarding
5. Vendor Creation, KYC, and Bank Account Verification
Cashfree supports vendor creation, updating, and retrieval through APIs. You can also upload the required vendor documents through the API.
Regarding KYC requirements:
Individual vendors: PAN and address proof are required.
Business vendors: GSTIN is required where applicable, including when the business crosses the applicable ₹20 lakh turnover threshold in 12 months.
Therefore, PAN and bank account details alone may not be sufficient in every case.
Vendor Activation Timeline:
Sandbox: Vendor activation generally takes approximately 10 minutes.
Production: Activation timelines may vary depending on the KYC and bank account verification process.
If a vendor remains in IN_BENE_CREATION status for more than 24 hours, you can raise a request through the Support Form for further investigation.
Common vendor failure or review statuses include:
BANK_VALIDATION_FAILED
BENE_CREATION_FAILED
ACTION_REQUIRED
ON_HOLD
You can update a vendor's bank account details through the Edit Vendor or Update Vendor Details functionality. The bank account can also be reverified as part of the update process.
Please refer to the Easy Split Vendor KYC Documentation and Vendor Onboarding Statuses.

5a. Pausing and Resuming Individual Vendor Settlements
Yes, you can mark an individual vendor as Blocked to stop further settlements to that vendor. You can subsequently unblock the vendor when you wish to resume settlements.
Additionally, Cashfree may place a vendor in ON_HOLD status based on applicable risk or compliance requirements.
In such cases:
The held amount will remain reflected in the vendor's balance within Cashfree's escrow account.
The amount will not be released to the vendor until the applicable restriction is resolved.
Refunds associated with split transactions may remain on hold if the required vendor or merchant balance is insufficient.
You can monitor the vendor's status through the vendor details and status APIs.
C. Refund Processing and Funding
6. How Refunds Are Handled Under Easy Split
Refund handling depends on whether the vendor split has been initiated and whether the vendor settlement has already been completed.
Cashfree supports automatic proportional debit of vendor balances based on their respective split shares. This behaviour can also be disabled, allowing you to specify the vendor-wise refund allocation through the refund_splits parameter when creating a refund.
Please refer to the Create Refund API.
The scenarios are as follows:
Scenario	Refund Handling
Before the vendor split	The refund is processed from your merchant balance.
After the split but before vendor settlement	The respective merchant and vendor balances are debited, including the vendor's held balance.
After vendor settlement	The vendor's share is adjusted against subsequent settlements, subject to the applicable balance and refund configuration.
These rules apply to full and partial refunds. Multiple partial refunds can be handled through the refund flow, subject to the available refundable amount and applicable balance requirements.
ON_HOLD vs. PENDING_APPROVAL
Based on our current product findings, refunds primarily move to ON_HOLD when sufficient funds are unavailable in either the merchant ledger or the vendor balance.
To release an ON_HOLD refund:
Recharge your merchant ledger if the merchant balance is insufficient.
If the vendor balance is insufficient, create a credit adjustment against the vendor balance.
The corresponding amount can be debited from your merchant ledger to fund the vendor balance.
Once the required balances are available, the refund can be processed.
The exact trigger and duration for PENDING_APPROVAL are separate from the insufficient-balance scenario and would need to be confirmed with the concerned team.

7. Insufficient Vendor Balance for Refunds and Chargebacks
If a vendor's balance is insufficient to cover its share of a refund, the refund may move to ON_HOLD.
In such cases, you can recharge your merchant ledger and transfer the necessary balance to the vendor through the vendor balance adjustment mechanism.
For chargebacks, the disputed amount is debited from your merchant ledger. You can subsequently recover the applicable amount from the respective vendor by creating a debit adjustment against that vendor's balance.
Please note that vendor balance recovery through adjustments needs to be managed based on your marketplace's agreed commercial arrangements.

8. Refund Reserve or Float for Refunds and Chargebacks
Currently, Cashfree does not provide a separate reserve or float facility under Easy Split specifically for maintaining funds to cover vendor refunds or chargebacks.
Refund and chargeback-related funding will need to be managed through your merchant ledger.
You can recharge your merchant ledger when required and use vendor balance adjustments to manage the respective vendor's share.

9. Refund Initiation Deadline
The refund API supports refund initiation within six months from the original payment capture date.
We understand that you have observed different timelines across the API documentation, merchant Terms and Conditions, and grievance policy.
The six-month period is the maximum refund window supported by the API. The references to 180 days and 120 days in other documents relate to different policy contexts and should not automatically be treated as interchangeable.
For transactions beyond the supported API refund window, we would need to review the applicable circumstances and confirm the available compliant resolution with the concerned team.

10. Refunds to Failed or Invalid UPI/Bank Accounts
If a refund to the original UPI VPA fails, an alternative refund route may be considered.
In such cases, you can provide an alternative UPI VPA belonging to the customer, along with the customer's consent, so that the refund can be processed through the applicable alternative route.
Alternatively, you can initiate the refund from your merchant ledger and subsequently create the necessary debit adjustment against the respective vendor balance.
For any specific failed refund, please share the Refund ID so that we can review the available resolution.

11. Are PG and Easy Split Charges Reversed on Refunds?
Please note that the applicable charges deducted for successfully processing the payment and split settlement are not reversed when a refund is initiated.
This includes:
Payment Gateway charges (MDR).
Easy Split service charges.
Applicable GST on the service charges.
Applicable settlement charges.
These charges are retained for the services already provided, irrespective of whether the customer subsequently receives a full or partial refund.
D. Chargebacks and Disputes
12. Chargeback Handling Under Easy Split
Under the current Easy Split chargeback handling process, the disputed amount is withheld or debited from the marketplace/merchant balance rather than directly from the vendor's balance.
Please note the following:
Vendor settlements continue as per the configured settlement arrangement.
The disputed amount is adjusted against your merchant balance.
You can subsequently recover the respective amount from the vendor by creating a debit adjustment against the vendor balance.
The final outcome depends on whether the dispute is successfully represented or resolved in the customer's favour.
Merchant of Record: From the Easy Split fund-flow perspective, the disputed amount is withheld from your marketplace/merchant balance rather than directly from the vendor. This settlement treatment does not, by itself, determine the formal legal Merchant of Record status, which depends on the contractual and business arrangement.
Chargeback/Dispute Fees: Currently, there are no separate chargeback or dispute processing fees.
If the Dispute Is Won: If the dispute is resolved in your favour, the disputed amount is reversed/released back in accordance with the final dispute outcome.
For dispute timelines, evidence requirements, and the representation process, please refer to the Dispute Management Documentation and Easy Split FAQs.
E. Fees and Pricing
13. Payment Gateway, Easy Split, Refund, and Vendor Verification Charges
The applicable charges depend on the pricing configured for your merchant account and the services enabled.
Please find the clarification currently available:
Charge Type	Applicable Pricing Details
UPI and Card MDR	As per the MDR configured under your merchant account.
Easy Split	Currently reflected as 0.20% in the Sandbox configuration. Production commercials need confirmation from your Account Manager.
Vendor Payout Charges	Subject to the applicable Payout pricing configuration.
Standard Refunds	No separate refund processing fee under the standard refund flow, subject to your account's applicable terms.
Instant Refunds	Subject to separate Instant Refund pricing.
Bank Account Verification	As per the applicable vendor verification pricing.

0% Promotional Pricing
Please note that the 0% MDR promotional offer does not apply to Easy Split service charges. Easy Split charges and other applicable fees will continue to apply as per the configured pricing.
You can refer to the applicable promotional pricing terms here:
Cashfree Pricing – 0% MDR Offer
For account-specific MDR, vendor payout charges, refund charges, and verification pricing, we recommend connecting with your Account Manager.

14. Payment Charges Webhook
Cashfree supports the PAYMENT_CHARGES_WEBHOOK event, which is available as Success Payment TDR when configuring webhooks.
This can help you receive transaction-level payment charge information and use it for your reconciliation and vendor commission calculations.
You can configure the event through your webhook settings.
Please refer to the Webhook Configuration Documentation.
F. Payments and Checkout
15. Multiple Successful Payments and Amount Mismatch
If two successful payments are received against the same Order ID, the additional payment amount is reversed to the customer as an excess/duplicate payment.
Regarding payments where the amount received differs from the original order amount, and whether the amount can be locked at the time of order creation, we are checking the exact behaviour and applicable configuration with the concerned Technical team.
16. Order Expiry and Late Payments
We have looped in the concerned Technical team to clarify the following:
Minimum and maximum supported order_expiry_time.
Whether an ACTIVE order can be manually closed once your 10-minute payment window expires.
Whether a payment can still succeed after order expiry.
How UPI payments that remain pending at expiry are reported through webhooks and transaction status updates.
17. Hosted Checkout, PCI DSS Scope, and Mobile SDK
We have forwarded your technical queries regarding the following to the concerned team:
Whether the Cashfree web checkout operates as a complete redirect or an embedded component.
Whether using the hosted checkout keeps your integration within PCI DSS SAQ A scope.
Whether Web Checkout or react-native-cashfree-pg-sdk is recommended for your hybrid Expo 54 / React Native 0.81 application.
We will share the appropriate integration recommendation once we receive confirmation.
18. PCI DSS and Security Attestation Requirements
We are checking whether any PCI self-assessment or additional security attestation is required from your end during onboarding, based on the proposed integration model.
19. Webhook Secret Rotation
We have also escalated your query regarding webhook secret rotation, specifically whether old and new webhook secrets can remain active simultaneously for a short overlap period during rotation.
The Technical team will confirm the supported mechanism.
G. Going Live and Production Onboarding
20. LLP Documentation, KYC, and Production Activation
We confirm that Easy Split is currently enabled in your Test/Sandbox environment.
Once you have completed the required sandbox testing, we will coordinate with the relevant Onboarding team to assist you with production activation for your LLP business entity.
The team will guide you through:
Required LLP registration and business documents.
KYC and authorised signatory verification.
Website/app verification, including the applicable Terms and Conditions, Privacy Policy, Refund/Cancellation Policy, and Contact Us details.
Vendor onboarding and verification requirements.
Production Easy Split activation and payment mode enablement.
The exact document requirements and review timeline will depend on the business verification and compliance assessment.

We recommend proceeding with the Sandbox integration and validating the vendor onboarding, split, deferred settlement, and refund flows before moving to Production.

We appreciate your detailed questions and interest in integrating Cashfree Easy Split for your marketplace. Our team will assist you further with the outstanding technical clarifications and production onboarding requirements.

Please note that your ticket ID is 8774207
```

---

## R2: Tech Team reply to points 16 to 19

Pasted 2026-11-10 11:44 UTC.

```text
Hi Team,

Greetings from Cashfree Tech Team.

In continuation of our previous response, please find our responses to points 16 to 19 below:

16. Order expiry: order_expiry_time should be more than 15 minutes and less than 30 days. If it is not passed, the order expires 30 days after creation. As a 10-minute window cannot be set as the order expiry, we recommend calling the Terminate Order API when your window closes. If a payment has already moved to success, the order may not be terminated, so kindly treat the order_status from the Get Order API and the payment webhooks as final. Please note that if a UPI payment is initiated before the order expiry and is completed by the customer after it, the payment will move to SUCCESS.

17. Checkout and SDK: Web checkout can be opened as a full redirect, a popup or inline within your page, and card details are entered on Cashfree's PCI DSS compliant hosted page. The applicable SAQ type should be confirmed by your PCI assessor. For your Expo app, we recommend the React Native SDK (react-native-cashfree-pg-sdk). It requires expo-dev-client and expo prebuild, and does not run in Expo Go.

18. PCI attestation: A PCI DSS certificate is required only for server-to-server (seamless) card integration. It is not required for the hosted checkout or SDK integration.

19. Webhook secret: Payment webhooks are signed with your API client secret, so rotating it means regenerating your API keys. Please note that for Payment Gateway, only one key pair remains active at any given time, so an overlap period with both the old and new keys is not supported. To rotate the keys, we request you to kindly pause all services using the current keys, generate the new keys, and then replace the new keys everywhere in your integration.

Documentation: https://www.cashfree.com/docs/api-reference/webhooks/payloads-and-signatures

Thank you for your understanding.
```

---

## R3: Tech Team reply to our second mail

Pasted 2026-11-10 16:55 UTC.

```text
Hi Team,

Greetings from Cashfree Tech Team.

Thank you for the detailed update and for confirming the deferred settlement requirement.

Please find our responses to your queries below:

1. Deferred settlement
- Configuration: We have noted the 45-day deferred settlement window for your sandbox account and shall confirm once it is configured.
- Default eligibility date: If an order is not updated, the settlement eligibility date will be the transaction date and time plus the deferral period.
- Updating the date: The eligibility date can be updated to any date within the deferral window. A date beyond the maximum eligibility date will be rejected.
- Settlement: Once the eligibility date is reached, the store's share is settled to the store as per its settlement schedule. We shall confirm the handling when the maximum deferral window is reached.
- Split after payment: Calling the Split API a few minutes after the payment, within the T+1 split delay, is correct. The store's share will then remain on hold until its eligibility date, and the split delay does not need to be changed.
- API details: PUT https://test.cashfree.com/api/v2/easy-split/orders/{orderid}/settlement-eligibility/vendors/{vendorid}, with settlementEligibilityDateUpdate in the format YYYY-MM-DD HH:mm:ss. Please note that this API supports only one split per vendor for an order.

2. Remaining points
- Refund after the store is settled: If the store's balance is lower than its share of the refund, the refund will be put on hold until the balance is available. You can fund it by creating an adjustment to the store's balance.
- Vendor KYC: Individual vendors require PAN and one address proof (Aadhaar, Driving Licence, Passport or Voter ID), and GSTIN is not required. We shall confirm the vendor type for sole proprietors without GST registration.
- Duplicate payments, amount locking, a pending UPI payment at order termination, refunds shortly after payment on a live account, and the PENDING_APPROVAL refund status: We are checking these with our team and shall confirm you the same.

3. Other points
- Charges: You can either bear the Payment Gateway and Easy Split charges or bill them to the store. The Easy Split charges are calculated on the order amount and not on the number of splits.
- Bank credit timing: After the eligibility date, the amount is credited as per the store's settlement schedule on bank working days, for example T+1 at 11:00 AM. A weekly schedule, which settles on the first working day of the week, is also available.
- Failed settlements and dispute simulation in sandbox: We shall confirm these with our team.

We will also coordinate with your Account Manager regarding the production pricing and onboarding.
Documentation: https://www.cashfree.com/docs/payments/split/settlements/delay/vendor-level

Thank you for your understanding.
```

---

## R4: Reply to our third mail

Pasted 2026-11-11 10:21 UTC.

```text
ear Merchant,
Greetings from Cashfree!
Thank you for sharing your queries. We have reviewed the points raised and would like to provide the following clarifications regarding Easy Split, deferred settlements, vendor onboarding, refunds and the related configurations.
1. Enabling the 45-day deferred settlement window on the production account
Easy Split supports a deferred settlement period of up to 45 days. However, enabling this configuration on your production account will be subject to an internal review and the required approvals.
We request you to complete the account signup and activation process first. Once the account is activated, you may coordinate with your Account Manager to have the 45-day deferred settlement configuration reviewed for production.
2. Handling of the vendor's share after the maximum deferral window
If split instructions are not provided within the configured settlement window, the entire transaction amount will be settled to the merchant by default. The vendor's share will not automatically be released to the vendor after the 45-day period.
Therefore, it is important to ensure that the split instructions are provided within the applicable window if you intend to settle the corresponding amount to the vendor.
Reference: https://www.cashfree.com/docs/payments/split/settlements/delay/order-level
3. Vendor type applicable to sole proprietors without GST registration
The applicable vendor type and KYC requirements are as follows:

* Individual Vendor: PAN and any one address proof, such as Aadhaar, Driving Licence, Passport or Voter ID. GSTIN is not required.
* Business Vendor: Business PAN and applicable business documents. GSTIN is required when the aggregate vendor settlements against a single PAN or merchant across vendors exceed ₹20 lakh in the preceding 12 months.

For a sole proprietor being onboarded in their individual capacity, the Individual vendor category can be used, subject to the applicable KYC requirements. The vendor's bank account details must also be provided for settlement purposes.
You may refer to the following documentation for further details:
Vendor KYC: https://cashfree.com/docs/payments/split/vendor/kyc
Add Vendor: https://cashfree.com/docs/payments/split/vendor/add
4. Automatic reversal of duplicate payments
In cases where a duplicate payment is automatically reversed, the reversal status can be tracked through the relevant transaction details and available payment reports/webhook notifications.
The expected reversal timeline is up to 5 calendar days. We recommend monitoring the transaction status and corresponding updates through your integration to reconcile the reversal.
5. UPI payments pending when an order is terminated
A UPI payment attempt that was initiated before the order expired may still receive a successful confirmation, depending on the state of the payment attempt and its applicable transaction validity period.
Please note that terminating an order at your application or internal system level does not necessarily cancel an already initiated payment attempt at the banking or payment-network level.
We recommend handling such scenarios through payment status verification and webhook notifications rather than relying solely on the internal order status. The final payment status should be verified before fulfilling or cancelling the order to avoid duplicate processing.
6. Refunds initiated shortly after a successful payment
The refund processing flow depends on whether the split instructions have already been shared.

* Refund initiated before the split is shared: The refund is processed against the merchant's payment balance and adjusted in the next settlement cycle.
* Refund initiated after the split is shared: The refund amount is debited proportionately from the merchant's and respective vendor's balances, based on the split instructions.

Therefore, a refund does not necessarily require a separate balance recharge if sufficient funds are already available in the relevant ledger balances. However, if the available merchant or vendor balance is insufficient, the refund will be placed in ON_HOLD until the required balance is available.
7. Refunds initiated after the vendor has already been settled
If the vendor's share has already been settled and the available vendor balance is insufficient to cover the refund, the refund will be placed on hold. The customer is not credited while the refund remains on hold.
In such cases, you can credit the vendor's balance through the Adjust Vendor Balance option to make the required funds available for refund processing.
Once the required merchant and vendor balances are available, the refund can proceed. The refund is not automatically recovered from the vendor's future settlements while the customer's refund is being processed.
For reference, you may review the following documentation:
Refund Scenarios: https://www.cashfree.com/docs/payments/split/refund/scenarios
Vendor Balance Adjustment: https://www.cashfree.com/docs/payments/split/vendor/balance/adjust
8. Refunds moving to PENDING_APPROVAL status
If a refund moves to PENDING_APPROVAL, it indicates that the request requires an internal review by our concerned team.
No additional action is required from your end at this stage. The request will be reviewed internally, and the status will be updated accordingly.
9. Handling failed vendor settlements
If a settlement to a vendor's bank account fails, the failure status and corresponding reason are communicated through the Vendor Settlement Webhooks.
The next course of action depends on the failure reason. For example, if the failure is due to incorrect bank account details or IFSC, the vendor's bank details must be corrected. If it is related to bank validation or KYC, the required details or documents must be updated. In cases involving insufficient balance, the necessary funds must be made available before the settlement can be retried.
You can refer to the following documentation for the available webhook events and failure reasons:
https://www.cashfree.com/docs/payments/split/webhooks
10. Dispute simulation in the sandbox environment
Currently, the complete dispute or chargeback lifecycle cannot be simulated in the sandbox environment. While certain vendor settlement statuses and reversal scenarios can be tested, full dispute lifecycle simulation is not supported.
Additional clarifications on your integration-related queries
We have also reviewed the eight points shared regarding the deferred settlement flow:
1. Default settlement eligibility date
Yes, this is correct. If no update is made to the settlement eligibility date, the vendor's settlement eligibility is determined based on the transaction date and the configured deferral period.
2. Updating the settlement eligibility date
Yes, the eligibility date can be updated within the configured deferral window. You may bring the eligibility date forward or set it to a later date, provided it does not exceed the maximum eligibility date permitted under the configured deferral period. Any date beyond this limit will be rejected by the API.
3. Sharing the Split API after payment success
Yes, this is correct. You can invoke the Split API a few minutes after a successful payment, provided the request is made within the configured split delay window.
Once the split instructions are successfully shared, the vendor's share will remain deferred until the applicable settlement eligibility date, after which it will be settled according to the vendor's configured settlement schedule.
Please note that the Split After Payment feature must be enabled for your account.
4. Vendor settlement schedule
Yes, weekly settlement is supported for Easy Split vendors.
The available schedule option 11 – Weekly every 1st working day allows vendor settlements to be processed on the first working day of each week. The settlement schedule can be configured individually for each vendor during onboarding or updated subsequently through the applicable vendor configuration.
Therefore, you can use this schedule for your stores, subject to the applicable account configuration and approvals.
5. Settlement eligibility update API
The Settlement Eligibility Update API operates at the order and vendor level. It allows you to update the eligibility date for a specific vendor associated with an order. Where multiple vendors are associated with an order, the eligibility date can be updated separately for each respective vendor.
6. Refunds after vendor settlement
As explained above, if the vendor's balance is insufficient to cover its share of the refund, the refund itself remains ON_HOLD until the required balance is available. You can credit the vendor's balance through an adjustment to facilitate the refund. The refund can then proceed once the required balances are available.
7. Vendor KYC
Yes, the KYC requirements for individual vendors include PAN and any one accepted address proof. GSTIN is not required for individual vendors.
8. Payment Gateway and Easy Split charges
The applicable Payment Gateway and Easy Split charges can be allocated to the merchant or vendor based on the billing configuration and commercial arrangement.
However, regarding the calculation basis, Easy Split carries an applicable per-split charge in addition to the standard PG charges. We recommend referring to the account-specific commercials for the exact chargeable basis rather than assuming that every Easy Split charge is calculated on the full order amount.
You may refer to the standard pricing details here:
https://www.cashfree.com/payment-gateway-charges/
Sandbox Configuration and Production Onboarding
We would also like to confirm that the 45-day deferred settlement window has been configured for your sandbox account. You may proceed with testing the deferred settlement flow in the sandbox environment.
Regarding production onboarding and pricing, we request you to complete the account signup and activation process first. Standard pricing (https://www.cashfree.com/payment-gateway-charges/) will be applicable upon account activation. Subsequently, you may coordinate with your Account Manager to discuss any specific pricing requirements or custom commercials for your business.
We hope the above clarifications address your queries and help you proceed with the integration and sandbox testing.
If you have any further questions or require clarification on any of the above points, please feel free to reach out to us. We are always here to help!

Your feedback is valuable to us, so we kindly ask you to take a moment to rate this interaction by taking the survey below.

Please note that your ticket ID is 8774207
Satisfaction survey: Response Satisfaction Survey
```
