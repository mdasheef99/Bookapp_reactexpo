# Phase 7/8: Second Mail to Cashfree

**Status:** sent by the owner on 2026-11-10, in reply to ticket 8774207. Answered by Cashfree's third reply (R3).

**As sent:** the text actually sent differs from this draft in places; the sent text is in the
[thread file](./PHASE-7-8-cashfree-thread-original.md) (stored 2026-11-12) and wins.
**Authority:** none. It answers Cashfree's request to confirm the deferred settlement
number and asks the points still open after its two replies.
**Related:** [replies and fact record](./PHASE-7-8-cashfree-replies.md) ·
[first mail](./PHASE-7-8-mail-cashfree.md)

The text below is the draft the owner approved. It was reviewed by Opus before sending. The
owner filled in the `<...>` fields.

---

**Subject:** Re: Ticket 8774207 – Deferred settlement configuration and remaining
clarifications (Merchant ID 11352134)

Dear Cashfree Team,

Thank you very much for both replies, including the Tech Team's answers to questions 16 to
19, and for enabling Easy Split on our sandbox account so quickly. We know our first list
was long, and we appreciate the care your team took over it. Your answers have resolved most
of our design questions. This mail confirms the configuration you asked about and raises the
few points that remain.

## 1. Deferred settlement configuration

You mentioned that deferred settlement has been requested for 3 days and asked us to confirm
the number. We are sorry our first mail was unclear on this. The 3 days we mentioned is
counted from the day the store hands over the book, not from the payment date. A store has
24 hours to accept an order, the customer then has a few days to collect it, and we release
the store's share on the Monday after those 3 days. From payment to release can therefore
run to two or three weeks.

Could you please enable deferred settlement on sandbox with a window of 45 days, so that we
have room to test this? We will set each order's settlement eligibility date ourselves
through the API. We would be grateful if you could confirm three points:

- If we never update an order, which eligibility date applies by default?
- Can we move an order's eligibility date earlier as well as later?
- When the eligibility date is reached, is the store's share settled to the store? And if
  the maximum window is reached first, is it settled to our merchant account instead?

Our account has Split After Payment at T+1, and we plan to call the Split API a few minutes
after each payment. Please confirm that the store's share then stays on hold until its
eligibility date, and that the split delay does not need changing.

You shared the endpoint for updating the eligibility date. We could not locate its page in
the documentation, and would be grateful for a link.

## 2. Points remaining from your answers

We went through your documentation and both replies carefully, and found answers to most of
our earlier points there. The few below are what remain.

- **Duplicate payments (question 15).** You confirmed that a second successful payment on an
  order is reversed to the customer. How is that reversal reported to us, so that we do not
  refund the same payment a second time? We also look forward to your Technical team's
  answer on amount locking, and to your confirmation of what places a refund in
  PENDING_APPROVAL and whether it then needs any action from us.
- **Late UPI payments (question 16).** If a UPI payment is pending when we terminate the
  order, can it still succeed? If so, how long after termination?
- **Vendor KYC (question 5).** Many of our stores are sole proprietors without GST
  registration. Should such a store be created as an individual or a business vendor, and is
  any document needed beyond PAN, address proof and bank details?
- **Refund soon after payment (question 6).** On sandbox, a refund created minutes after a
  successful payment moved to ON_HOLD for insufficient balance. On a live account, can such
  a refund be funded from the payment just collected, or only from a balance we have
  recharged?
- **Refund after the store has been settled (question 7).** If the store's balance is short,
  does the refund wait in ON_HOLD until we fund it, or is the customer paid and the amount
  recovered from the store's later settlements?

## 3. Points we could not find in the documentation

We searched the documentation for these as well, but could not find them covered.

- **Who bears the charges.** Are the payment gateway and Easy Split charges deducted from
  the store's share, from ours, or is this configurable? Is the Easy Split charge calculated
  on the full payment or on the store's share?
- **Bank credit timing.** After the eligibility date, how many working days does it take for
  the amount to reach the store's bank account?
- **Failed settlement.** If a settlement to a store's bank account fails, does the amount
  return to the store's balance, and is it retried automatically?
- **Disputes on sandbox.** Is there a way to simulate a dispute on sandbox?

## Looking ahead

As we move towards production, we would be grateful if you could introduce us to our Account
Manager, so that we can confirm production pricing. We would also welcome any early guidance
from your Onboarding team on the usual review time for an LLP, whether we may go live with
UPI and cards only, and how the merchant ledger is recharged.

We will continue our sandbox testing in the meantime. Thank you once again for your patience
and support.

Warm regards,
`<Name>`
`<Designation>`, BookConnect (`<LLP name>`)
`<Phone>` · Merchant ID 11352134
