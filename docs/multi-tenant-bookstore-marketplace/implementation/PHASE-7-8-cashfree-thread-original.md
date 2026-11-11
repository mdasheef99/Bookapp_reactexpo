# Phase 7/8: Cashfree Mail Thread, Original Text

**Status:** the whole Gmail thread for ticket 8774207, from our first mail (10 Nov 2026) to
our thank-you mail (11 Nov 2026), stored word for word on 2026-11-12. It is exactly the
text the owner copied from Gmail and pasted into the working session; nothing is edited,
shortened or corrected (Gmail's own "[Message clipped]" marks, typos and quoted tails are
kept).
**Why this file exists:** the [replies file](./PHASE-7-8-cashfree-replies-original.md) holds
Cashfree's four replies but not our mails as actually sent, Cashfree's send times, who
signed each reply, the ticket acknowledgement, or our closing mail. Our mail files
([first](./PHASE-7-8-mail-cashfree.md), [second](./PHASE-7-8-mail-cashfree-2.md),
[third](./PHASE-7-8-mail-cashfree-3.md)) are drafts and differ from what was sent in places.
**Authority:** primary evidence, together with the replies file. If a draft, a fact
(CF-xx) or a summary disagrees with this text, this text wins.

## Messages in the thread

Times are as Gmail shows them (IST, UTC+5:30).

| # | When (IST) | From | What | Tag in replies file |
|---|---|---|---|---|
| 1 | Tue 10 Nov 2026, 9:13 AM | Us (MD ASHEEF NAGARALLI) | First mail: Easy Split activation and questions 1 to 20, items A to D | — |
| 2 | Tue 10 Nov 2026, 9:13 AM | Cashfree Care (automatic) | Ticket 8774207 created | — |
| 3 | Tue 10 Nov 2026, 2:00 PM | Cashfree Care, signed Amit Paul | Easy Split enabled on sandbox; answers 1 to 20 | R1 |
| 4 | Tue 10 Nov 2026, 3:26 PM | Cashfree Tech Team, signed Shreejoy Chatterjee (Integration Engineer) | Answers 16 to 19 | R2 |
| 5 | Tue 10 Nov 2026, 6:14 PM | Us | Second mail: 45-day window, remaining points | — |
| 6 | Tue 10 Nov 2026, 7:14 PM | Cashfree Tech Team, signed Shreejoy Chatterjee | Answers to the second mail | R3 |
| 7 | Wed 11 Nov 2026, 9:35 AM | Us | Third mail: our understanding, points awaited | — |
| 8 | Wed 11 Nov 2026, 1:20 PM | Cashfree Care, signed Nikhil Scaria | Answers to the third mail; 45-day window configured on sandbox | R4 |
| 9 | Wed 11 Nov 2026, 3:57 PM | Us | Thank-you mail: "Your team has answered every point we raised" | — |

Note on message 9: it told Cashfree every point was answered. That was based on my wrong
reading; three points were still open (CF-A3, CF-A12, CF-A14) and seven facts had been
missed (CF-67 to CF-73). The [fourth mail draft](./PHASE-7-8-mail-cashfree-4.md) says so
openly.

## The thread as pasted

```text
Skip to content
Using Gmail with screen readers
2 of 118
Request to activate Easy Split and integration questions for a marketplace
Inbox

MD ASHEEF NAGARALLI <conceptsphereai@gmail.com>
Tue, Nov 10, 9:13 AM (2 days ago)
to care

Hello Cashfree team,

We are from Conceptshpere Technologies LLP.We have recently signed into your platform for payment gateway services, our account is
 in using this mail. Our Merchant ID is 11352134. BookConnect is a
marketplace app where independent Bengaluru bookstores sell new and used printed books. Each
store is the seller. We are integrating the Payment Gateway with Easy Split, on API version
`2026-01-01`.

This mail has two parts: one request that blocks our testing now, and our integration
questions. If the questions go to a different team, please forward them and deal with Part 1
first.

## Part 1: please enable Easy Split on our sandbox account

Easy Split is not active on our test account, so we cannot test vendors, splits or vendor
settlements.

- Calling `/simulate/easy-split/enable` on `https://sandbox.cashfree.com/pg` returns HTTP 500.
- Ordinary orders, payments and refunds work on the same account.

Please enable Easy Split for sandbox on Merchant ID 11352134, with Split After Payment and
deferred (on-hold) vendor settlement, and tell us when it is active. Please also tell us
what we must do to get the same setup on the production account later.

## Part 2: integration questions

**How we plan to use Cashfree.** Customers pay by UPI or card only; there is no cash on
delivery. Each order has one store (one vendor). The store's share should stay with Cashfree
until we release it, and then be settled to the store's bank account. BookConnect's own part
of a payment is the delivery charge, which we pay on to the delivery provider. We do not
want BookConnect to hold pooled customer money.

**Most urgent**, because they shape our design: questions 1, 2, 4, 5a, 6, 7 and 8. Fees (13,
14) can follow. Going live (20) is needed before launch.

### Easy Split setup and payout timing

1. What is the longest split delay and the longest settlement hold our account can have? Is
   the 45-day maximum hold firm? Your pages describe a 48-hour maximum split delay and a
   45-day hold, and the default delay and API path differ between pages.
2. We want to hold each store's share until we release it. Our plan is to release it 3 days
   after the store hands the book over, in the next weekly Monday payout.
   - Can the release date be set or changed for each order by API after payment (we have
     seen `settlementEligibilityDateUpdate`)?
   - Your v2 settlement-eligibility API says a date can be set only within the maximum
     deferral window. What is that window for our account?
   - What happens to a held share when its limit is reached?
3. Can each store be paid once a week, on Mondays? Which settlement types does our account
   have (instant, standard, on-demand)? Which settlement timelines apply to marketplace
   vendors under the RBI Payment Aggregator Directions, 2025?
4. Where does the customer's money sit between payment and settlement, and who holds it? Is
   Easy Split suitable for us, given that the delivery-charge part of each payment goes to
   BookConnect? Could the delivery provider instead be added as a vendor, so its share is
   split to it directly?

### Store (vendor) onboarding

5. Can vendors be created, verified and updated by API? Which KYC is required? Many of our
   stores are small proprietors without GST registration: is a PAN plus a bank account
   enough? How long does activation take, why can it be rejected, and how is a store
   re-verified when it changes its bank details?

5a. Can we pause one store's settlements at any time (for example during a fraud review, or
   while the store owes us money) and release them later? If you suspend or freeze a store's
   vendor account yourselves, how are we told, and what happens to its held money and to
   refunds on its orders?

### Refunds

6. How does a refund take back the store's share? Please cover full refunds, partial refunds
   and several partial refunds on one order, both before and after the store has been paid.
   Is the store's share reversed automatically, or must we specify it on each refund (for
   example with `refund_splits`)? What causes the `PENDING_APPROVAL` and `ONHOLD` refund
   statuses, and how long can a refund stay in them?
7. If a store's balance is too low to cover a refund or a chargeback, what happens: is the
   refund blocked, does BookConnect's balance pay, or is it recovered from the store's later
   settlements?
8. Can BookConnect keep a refund reserve or float with Cashfree, to fund refunds and
   chargebacks when a store's balance is short? How is refund funding handled on a live
   account, and how do we top up that balance?
9. Refund time limit: your API page says six months, the merchant terms say 180 days, and
   the grievance policy says 120 days. Which applies to our account? After that limit, what
   compliant way do you support to refund a customer who is still entitled to a refund?
10. If a refund to the original UPI or card account fails (for example the account is closed
    or the refund is rejected), where does the money go, and what is the compliant
    alternative?
11. When a payment is refunded, in full or in part, is your payment fee returned to us?

### Chargebacks

12. Under Easy Split, who is debited for a chargeback, and how is the store's share
    recovered? Please describe the process, the timelines and the evidence you need.
    - For chargebacks, who is the merchant of record: BookConnect or the store? Your pages
      say the disputed amount is withheld from the marketplace's balance, not the vendor's.
    - Is there a chargeback or dispute fee?
    - If we win the dispute, or it is reversed, are the amount and any fee returned?

### Fees

13. What are your fees for each payment method (UPI, cards), the Easy Split fee per split (we
    have seen 0.2% and 0.25%), vendor payouts, refunds (standard and instant) and bank
    account verification? Is there startup or promotional pricing? We saw an offer of zero
    fees on the first ₹20 lakh until 31 March 2027: does it apply to our account, and does
    it cover Easy Split?
14. Can the payment fee be reported per transaction (for example through the payment charges
    webhook), so we can deduct it from that store's share? How is that webhook enabled for
    our account?

### Payments and checkout

15. How are two successful payments for one order reported? How is a paid amount that
    differs from the order amount reported? Can the amount be locked when the order is
    created?
16. What are the minimum and maximum `order_expiry_time`? Can we end an `ACTIVE` order when
    our own 10-minute payment window closes? Can a payment still succeed after the order
    expires, and how is a UPI payment that is still pending at expiry reported to us?
17. Is your web checkout a full redirect to a Cashfree-hosted page, or an embedded component?
    Does that keep us in PCI DSS SAQ A scope? Our app is a hybrid Expo 54 / React Native 0.81
    app: do you recommend web checkout or `react-native-cashfree-pg-sdk` for it?
18. Do you require a PCI self-assessment or another security attestation from us during
    onboarding?
19. Can the webhook secret be rotated with an overlap period, so that old and new secrets
    both work for a short time?

### Going live

20. For live mode: which documents do you need from an LLP, how long does the review take,
    and which website or app policy pages do you check? When and how is Easy Split enabled
    for live mode? Can live mode start with UPI and cards only?

### Please confirm what we read or saw

These are things we took from your public pages or saw in sandbox. Please confirm each, or
correct it.

- A. The platform adds vendors itself, by dashboard or API; a store does not register with
  Cashfree separately.
- B. In sandbox, a refund made right after a paid order went `ONHOLD` with "insufficient
  account balance". Is that the expected behaviour, and does a live account behave the same
  way until the payment is settled?
- C. In sandbox, an order created without `order_expiry_time` got an expiry 30 days later.
  Is 30 days the default on live accounts too?
- D. `2026-01-01` is the right API version for a new integration, and Easy Split, refunds
  and webhooks all support it.

A written reply by email is what we need, since we will build to these answers. We are also
happy to go through them on a call first.

Thank you,
Md Asheef K N
8904402282
 Merchant ID 11352134

Cashfree Care
Tue, Nov 10, 9:13 AM (2 days ago)
to me

Hi,


Thanks for reaching out! We’ve received your request and created a ticket. A support representative will get back to you shortly.


For quicker help with PG, Payouts, Settlements, or Refunds, feel free to use our 24/7 Chatbot on your dashboard:
Go to Chatbot.

If you haven’t used your registered email ID or haven’t shared the email linked to your merchant account, please send it over to help us resolve your query faster (for registered merchants only).


Issue Faced: Request to activate Easy Split and integration questions for a marketplace
Issue Description:
Your ticket ID is 8774207.  You can track the status of your ticket using this link - https://cashfreepayments.freshdesk.com/support/tickets

Thank you for your patience.

Sincerely,
Team Cashfree!

8774207:1188001

Cashfree Care
Tue, Nov 10, 2:00 PM (2 days ago)
to me

Dear Merchant,

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

Your feedback will help us get better!
Extremely dissatisfied
Mostly dissatisfied
Neither satisfied nor dissatisfied
Mostly satisfied
Extremely satisfied

Thank you,

Amit Paul 

Cashfree Care

"This e-mail is intended for the addressee shown. It contains information that is confidential and protected from disclosure. Any review, dissemination or use of this transmission or its contents by persons or unauthorized employees of the intended organizations is strictly prohibited."

If you are not satisfied with the above response, please write to escalations@cashfree.com and we will be happy to assist you further.

On Tue, 10 Nov at 9:13 AM , Cashfree Care <care@cashfree.com> wrote: 
Hi,

Thanks for reaching out! We’ve received your request and created a ticket. A support representative will get back to you shortly.

For quicker help with PG, Payouts, Settlements, or Refunds, feel free to use our 24/7 Chatbot on your dashboard:
Go to Chatbot.

If you haven’t used your registered email ID or haven’t shared the email linked to your merchant account, please send it over to help us resolve your query faster (for registered merchants only).

Issue Faced: Request to activate Easy Split and integration questions for a marketplace
Issue Description:
...

[Message clipped]  View entire message

Cashfree Care
Tue, Nov 10, 3:26 PM (2 days ago)
to me

Hi Team,

Greetings from Cashfree Tech Team.

In continuation of our previous response, please find our responses to points 16 to 19 below:

16. Order expiry: order_expiry_time should be more than 15 minutes and less than 30 days. If it is not passed, the order expires 30 days after creation. As a 10-minute window cannot be set as the order expiry, we recommend calling the Terminate Order API when your window closes. If a payment has already moved to success, the order may not be terminated, so kindly treat the order_status from the Get Order API and the payment webhooks as final. Please note that if a UPI payment is initiated before the order expiry and is completed by the customer after it, the payment will move to SUCCESS.

17. Checkout and SDK: Web checkout can be opened as a full redirect, a popup or inline within your page, and card details are entered on Cashfree's PCI DSS compliant hosted page. The applicable SAQ type should be confirmed by your PCI assessor. For your Expo app, we recommend the React Native SDK (react-native-cashfree-pg-sdk). It requires expo-dev-client and expo prebuild, and does not run in Expo Go.

18. PCI attestation: A PCI DSS certificate is required only for server-to-server (seamless) card integration. It is not required for the hosted checkout or SDK integration.

19. Webhook secret: Payment webhooks are signed with your API client secret, so rotating it means regenerating your API keys. Please note that for Payment Gateway, only one key pair remains active at any given time, so an overlap period with both the old and new keys is not supported. To rotate the keys, we request you to kindly pause all services using the current keys, generate the new keys, and then replace the new keys everywhere in your integration.

Documentation: https://www.cashfree.com/docs/api-reference/webhooks/payloads-and-signatures

Thank you for your understanding.



Your ticket ID is 8774207
Thanks and Regards,
Shreejoy Chatterjee | Integration Engineer | Cashfree Payments
Your feedback will help us get better!
Extremely dissatisfied
Mostly dissatisfied
Neither satisfied nor dissatisfied
Mostly satisfied
Extremely satisfied

Dear Merchant,

On Tue, 10 Nov at 9:13 AM , Cashfree Care <care@cashfree.com> wrote: 
Hi,

Thanks for reaching out! We’ve received your request and created a ticket. A support representative will get back to you shortly.

For quicker help with PG, Payouts, Settlements, or Refunds, feel free to use our 24/7 Chatbot on your dashboard:
Go to Chatbot.

If you haven’t used your registered email ID or haven’t shared the email linked to your merchant account, please send it over to help us resolve your query faster (for registered merchants only).

Issue Faced: Request to activate Easy Split and integration questions for a marketplace
Issue Description:
...

[Message clipped]  View entire message

MD ASHEEF NAGARALLI <conceptsphereai@gmail.com>
Tue, Nov 10, 6:14 PM (2 days ago)
to Cashfree

Dear Cashfree Team,

Thank you very much for both replies, including the Tech Team’s answers to questions 16 to 19, and for enabling Easy Split on our sandbox account so quickly. We know our first list was long, and we appreciate the care your team took over it. Your answers have resolved most of our design questions. This mail confirms the configuration you asked about and raises the few points that remain.

1. Deferred settlement configuration

You mentioned that deferred settlement has been requested for 3 days and asked us to confirm the number. We are sorry our first mail was unclear on this. The 3 days we mentioned is counted from the day the store hands over the book, not from the payment date. A store has 24 hours to accept an order, the customer then has a few days to collect it, and we release the store’s share on the Monday after those 3 days. From payment to release can therefore run to two or three weeks.

Could you please enable deferred settlement on sandbox with a window of 45 days, so that we have room to test this? We will set each order’s settlement eligibility date ourselves through the API. We would be grateful if you could confirm three points:

If we never update an order, which eligibility date applies by default?
Can we move an order’s eligibility date earlier as well as later?
When the eligibility date is reached, is the store’s share settled to the store? And if the maximum window is reached first, is it settled to our merchant account instead?
Our account has Split After Payment at T+1, and we plan to call the Split API a few minutes after each payment. Please confirm that the store’s share then stays on hold until its eligibility date, and that the split delay does not need changing.

You shared the endpoint for updating the eligibility date. We could not locate its page in the documentation, and would be grateful for a link.

2. Points remaining from your answers
    We went through your documentation and both replies carefully, and found answers to most of our earlier points there. The few below are what remain.

Duplicate payments (question 15). You confirmed that a second successful payment on an order is reversed to the customer. How is that reversal reported to us, so that we do not refund the same payment a second time? We also look forward to your Technical team’s answer on amount locking.
Late UPI payments (question 16). If a UPI payment is pending when we terminate the order, can it still succeed? If so, how long after termination?
Vendor KYC (question 5). Many of our stores are sole proprietors without GST registration. Should such a store be created as an individual or a business vendor, and is any document needed beyond PAN, address proof and bank details?
Refund soon after payment (question 6). On sandbox, a refund created minutes after a successful payment moved to ON_HOLD for insufficient balance. On a live account, can such a refund be funded from the payment just collected, or only from a balance we have recharged?
Refund after the store has been settled (question 7). If the store’s balance is short, does the refund wait in ON_HOLD until we fund it, or is the customer paid and the amount recovered from the store’s later settlements?
3. Points we could not find in the documentation

Who bears the charges. Are the payment gateway and Easy Split charges deducted from the store’s share, from ours, or is this configurable? Is the Easy Split charge calculated on the full payment or on the store’s share?
Bank credit timing. After the eligibility date, how many working days does it take for the amount to reach the store’s bank account?
Failed settlement. If a settlement to a store’s bank account fails, does the amount return to the store’s balance, and is it retried automatically?
Disputes on sandbox. Is there a way to simulate a dispute on sandbox?

  We also look forward to your Technical team’s answer on amount locking, and to your confirmation of what places a refund in PENDING_APPROVAL and whether it then needs any action from us.  
Looking ahead

As we move towards production, we would be grateful if you could introduce us to our Account Manager, so that we can confirm production pricing. We would also welcome any early guidance from your Onboarding team on the usual review time for an LLP, whether we may go live with UPI and cards only, and how the merchant ledger is recharged.

We will continue our sandbox testing in the meantime. Thank you once again for your patience and support.

Warm regards,


Cashfree Care
Tue, Nov 10, 7:14 PM (2 days ago)
to me

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



Your ticket ID is 8774207
Thanks and Regards,
Shreejoy Chatterjee | Integration Engineer | Cashfree Payments
Your feedback will help us get better!
Extremely dissatisfied
Mostly dissatisfied
Neither satisfied nor dissatisfied
Mostly satisfied
Extremely satisfied

8774207:1188001

MD ASHEEF NAGARALLI <conceptsphereai@gmail.com>
Wed, Nov 11, 9:35 AM (16 hours ago)
to Cashfree

Dear Cashfree Tech Team,

Greetings,.

Thank you for your detailed response. It has been very helpful for our integration planning. We are writing to confirm our understanding of the points you have answered, and to list the points on which we await your confirmation.

1. Our understanding of your responses

Kindly let us know if any of the following is incorrect.

If an order is not updated, its settlement eligibility date is the transaction date and time plus the deferral period.
The eligibility date can be updated to any earlier or later date within the deferral window. A date beyond the maximum eligibility date is rejected.
Calling the Split API a few minutes after the payment is successful, within the T+1 split delay, is correct. The store’s share then remains on hold until its eligibility date.
Once the eligibility date is reached, the store’s share is settled to the store as per its settlement schedule, on bank working days. A weekly schedule, which settles on the first working day of the week, is available, and we intend to use it for our stores. As an earlier response indicated that a recurring weekly schedule was not available, we request you to kindly confirm that this weekly schedule is supported for Easy Split vendors and can be set for each vendor.
The settlement eligibility update API supports one split per vendor for an order.
If a refund is raised after the store has been settled and the store’s balance is lower than its share, the refund remains on hold until the balance is available, and we can fund it by creating an adjustment to the store’s balance. Kindly confirm whether it is the customer’s refund itself that remains on hold, or only the recovery of the store’s share. Once we fund the required amount through an adjustment, is the refund resumed automatically, or must we initiate another action? We would also request the expected processing timeline in that case.
An individual vendor requires PAN and one address proof, and GSTIN is not required.
The Payment Gateway and Easy Split charges can either be borne by us or billed to the store. The Easy Split charges are calculated on the order amount.
2. Points awaiting your confirmation

As mentioned in your response, we understand you are checking the following with your team. We shall wait for your update.

Can the 45-day deferred settlement window  can be enabled on our production account, subject to the required approvals.
The handling of a store’s share when the maximum deferral window is reached.
The vendor type applicable to a sole proprietor without GST registration.
How an automatic duplicate-payment reversal is reported to the merchant (API, webhook or settlement report), and the expected or maximum timeframe for the reversal.
Whether a UPI payment that is pending at the time of order termination can still succeed, and within what period.
Whether, on a live account, a refund raised shortly after payment can be funded from that payment.
The circumstances in which a refund moves to the PENDING_APPROVAL status, and whether any action is required from us.
The handling of a failed settlement to a store’s bank account.
Whether a dispute can be simulated in the sandbox environment.
We will begin our sandbox testing of the deferred settlement flow as soon as the 45-day window is confirmed as configured.

We also note that you will coordinate with our Account Manager on production pricing and onboarding, and we thank you for the same.

Thank you once again for your support.

Warm regards,
Md Asheef


Cashfree Care
Wed, Nov 11, 1:20 PM (13 hours ago)
to me

Dear Merchant,

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
Individual Vendor: PAN and any one address proof, such as Aadhaar, Driving Licence, Passport or Voter ID. GSTIN is not required.
Business Vendor: Business PAN and applicable business documents. GSTIN is required when the aggregate vendor settlements against a single PAN or merchant across vendors exceed ₹20 lakh in the preceding 12 months.
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
Refund initiated before the split is shared: The refund is processed against the merchant's payment balance and adjusted in the next settlement cycle.
Refund initiated after the split is shared: The refund amount is debited proportionately from the merchant's and respective vendor's balances, based on the split instructions.
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

Warm regards,
Nikhil Scaria
Cashfree Care

"This e-mail is intended for the addressee shown. It contains information that is confidential and protected from disclosure. Any review, dissemination or use of this transmission or its contents by persons or unauthorized employees of the intended organizations is strictly prohibited."
If you are not satisfied with the above response, please write to escalations@cashfree.com and we will be happy to assist you further.



Thank you once again for your support.
Warm regards,
Md Asheef

On Tue, 10 Nov at 6:14 PM , NA <conceptsphereai@gmail.com> wrote:
8774207:1188001

MD ASHEEF NAGARALLI <conceptsphereai@gmail.com>
Wed, Nov 11, 3:57 PM (10 hours ago)
to Cashfree

Dear Cashfree Team,

Greetings

Thank you very much for your detailed response, and for your patience with our many questions over the past few days. Your team has answered every point we raised clearly and thoroughly. This has given us the clarity we needed to plan our integration with confidence.

We also thank you for configuring the 45-day deferred settlement window on our sandbox account. We will now begin testing the deferred settlement, refund and vendor settlement flows on sandbox. If anything needs clarification during testing, we will write to you again.

As advised, we will complete the account signup and activation process. After that, we will coordinate with our Account Manager on the 45-day deferred settlement window for production and on pricing.

Thank you once again for your support and guidance.

Warm regards,
Md Asheef
8904402282
```
