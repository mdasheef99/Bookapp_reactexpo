# Phase 7/8: Third Mail to Cashfree

**Status:** sent by the owner on 2026-11-11, in reply to Cashfree's third reply (R3). No
reply yet.
**Authority:** none. It confirms our understanding of R3 and lists the points still
awaited.
**Related:** [replies and fact record](./PHASE-7-8-cashfree-replies.md) ·
[second mail](./PHASE-7-8-mail-cashfree-2.md)

The text below is the draft the owner approved in chat, as last amended. If the owner
changed anything before sending, the sent copy is the authority. The wrong-amount question
(CF-A6) was left out on purpose: the server compares the amount whatever Cashfree answers.

---

**Subject:** Re: Easy Split deferred settlement – confirmation of our understanding and
pending points

Dear Cashfree Tech Team,

Greetings from BookConnect.

Thank you for your detailed response. It has been very helpful for our integration
planning. We are writing to confirm our understanding of the points you have answered, and
to list the points on which we await your confirmation.

**1. Our understanding of your responses**

Kindly let us know if any of the following is incorrect.

1. If an order is not updated, its settlement eligibility date is the transaction date and
   time plus the deferral period.
2. The eligibility date can be updated to any earlier or later date within the deferral
   window. A date beyond the maximum eligibility date is rejected.
3. Calling the Split API a few minutes after the payment is successful, within the T+1
   split delay, is correct. The store's share then remains on hold until its eligibility
   date.
4. Once the eligibility date is reached, the store's share is settled to the store as per
   its settlement schedule, on bank working days. A weekly schedule, which settles on the
   first working day of the week, is available, and we intend to use it for our stores. As
   an earlier response indicated that a recurring weekly schedule was not available, we
   request you to kindly confirm that this weekly schedule is supported for Easy Split
   vendors and can be set for each vendor.
5. The settlement eligibility update API supports one split per vendor for an order.
6. If a refund is raised after the store has been settled and the store's balance is lower
   than its share, the refund remains on hold until the balance is available, and we can
   fund it by creating an adjustment to the store's balance. Kindly confirm whether it is
   the customer's refund itself that remains on hold, or only the recovery of the store's
   share. Once we fund the required amount through an adjustment, is the refund resumed
   automatically, or must we initiate another action? We would also request the expected
   processing timeline in that case.
7. An individual vendor requires PAN and one address proof, and GSTIN is not required.
8. The Payment Gateway and Easy Split charges can either be borne by us or billed to the
   store. The Easy Split charges are calculated on the order amount.

**2. Points awaiting your confirmation**

As mentioned in your response, we understand you are checking the following with your
team. We shall wait for your update.

1. Confirmation that the 45-day deferred settlement window has been configured on our
   sandbox account, and whether the same window can be enabled on our production account,
   subject to the required approvals.
2. The handling of a store's share when the maximum deferral window is reached.
3. The vendor type applicable to a sole proprietor without GST registration.
4. How an automatic duplicate-payment reversal is reported to the merchant (API, webhook
   or settlement report), and the expected or maximum timeframe for the reversal.
5. Whether a UPI payment that is pending at the time of order termination can still
   succeed, and within what period.
6. Whether, on a live account, a refund raised shortly after payment can be funded from
   that payment.
7. The circumstances in which a refund moves to the PENDING_APPROVAL status, and whether
   any action is required from us.
8. The handling of a failed settlement to a store's bank account.
9. Whether a dispute can be simulated on the sandbox environment.

We will begin our sandbox testing of the deferred settlement flow as soon as the 45-day
window is confirmed as configured.

We also note that you will coordinate with our Account Manager on production pricing and
onboarding, and we thank you for the same.

Thank you once again for your support.

Warm regards,
Md Asheef
BookConnect
