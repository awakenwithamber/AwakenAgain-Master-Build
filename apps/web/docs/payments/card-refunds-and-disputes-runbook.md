# Card refunds and disputes — admin runbook (Authorize.net)

For: Amber (owner/admin). Scope: shop orders paid by card at
AwakenAgain.com (`Pay by card`, Authorize.net hosted checkout).
Written 2026-11-09 with the card checkout build. Plain language,
short on purpose.

**The hard rule: nothing about refunds or disputes is automatic.**
No button on the website issues a refund, and no system files a
dispute response for you. Both are manual, done by you, in the
processor's own interface. The website only *records* what happened:
when a refund or void is reported back to the site by the verified
webhook, the order's state changes to **refunded** (or cancelled for
a void) and an audit row is written — the site never starts it.

---

## 1. How to refund a card payment

Refund the way the money came in: through Authorize.net, back to
the customer's original card. (Orders paid by Bluevine invoice or
Cash App/Venmo are refunded on those rails instead, under the
existing returns rules: unopened items returnable within 30 days of
delivery; opened consumables are final sale except damaged or
wrong-item, per the site returns policy.)

Steps (Authorize.net Merchant Interface — check in the dashboard if
a menu name differs in your account's interface version):

1. Sign in to the Authorize.net Merchant Interface.
2. Go to **Payments → Manage Transactions** and find the original
   transaction (search by the Transaction ID from the order's
   payment record, the order number, or the customer name).
   - The order number on the website is the transaction's invoice
     number — that's the fastest way to match them.
3. Check it can be refunded: only a **settled** transaction can be
   refunded, and only **within 180 days** of settlement. If it has
   not settled yet, do not refund — **void** it instead (voids
   cancel the payment before settlement; see the same transaction
   screen).
4. Open the transaction and click **Refund**. Leave the amount as
   the full amount for a full refund, or lower it for a partial
   refund.
5. Submit, and save the refund's own Transaction ID from the
   confirmation screen.
6. What happens on the website: the refund is reported back to the
   site automatically by webhook, and the order's state becomes
   **refunded** (you can see it in the order's paid state / admin
   orders). If the order does not show refunded after a reasonable
   wait, check the order's audit rows before doing anything else —
   do not refund twice.

Refunds go only to the original card used — never to a different
card, and never by Cash App/Venmo for a card order (that mismatch is
how refund fraud works).

Sources: Authorize.net Support Center, "issuing a refund
transaction" — https://support.authorize.net/knowledgebase/Knowledgearticle/?code=KA-09324
and https://support.authorize.net/knowledgebase/Knowledgearticle/?code=000001221
(settled-only, 180-day, original-payment-method, and Manage
Transactions steps are from those articles, read 2026-11-09).

## 2. How to respond to a chargeback (dispute)

**Bluevine does NOT cover chargebacks.** A chargeback on a card
order has nothing to do with your Bluevine account — do not send
the response there.

Who actually handles it: Authorize.net is the payment *gateway*.
Card chargebacks are run by your merchant processor / acquirer
(the provider behind your Authorize.net All-in-One account), and
the evidence response goes **through that processor/acquirer** —
Authorize.net's own guidance says merchants respond "through their
acquirer or processor." Check in the dashboard / your account
paperwork who that provider is and exactly where they take
evidence and notices; menu names and portals differ by provider,
so verify there rather than guessing.

What to do, in order:

1. **Note the deadline the moment the notice arrives.** The
   response deadline is set by the processor/card network and is
   stated on the dispute notice — it is not in this runbook because
   it varies by case. Missing it usually means the chargeback
   stands automatically. (If you ever see a pre-dispute / CDRN
   alert instead of a full chargeback, Authorize.net's article
   describes a 72-hour window to resolve it by refund — check the
   alert itself for its own deadline.)
2. **Do not refund the order yourself once a chargeback is open** —
   the money has already been pulled by the bank; refunding again
   pays the customer twice.
3. **Gather the evidence** (from the website's records first):
   - the order record: order number, date/time placed, items,
     total charged, customer name and email;
   - the payment record: Authorize.net Transaction ID, amount,
     and the paid timestamp;
   - the order's audit rows (awaiting_payment → paid, with times) —
     they are the site's own timeline of the charge;
   - shipping proof: carrier tracking number and the delivery
     confirmation showing the delivery address matching the order;
   - any emails/messages with the customer about the order.
4. **Submit the evidence through the processor/acquirer channel**
   named on the notice, before its deadline, and save the
   submission confirmation.
5. **Record what you did** with the order's paperwork (date
   submitted, what was sent). The website builds nothing automatic
   for disputes — no state on the site changes a dispute outcome.

Sources: Authorize.net, "Chargebacks and how to proactively resolve
them" — https://www.authorize.net/blog/fraud-prevention/proactively-resolve-chargeback-disputes.html
(response goes through the acquirer/processor; CDRN 72-hour
pre-dispute window), read 2026-11-09.

## 3. Fees and terms — confirm, don't assume

This runbook deliberately states **no fee amounts and no fixed
deadlines**: the chargeback fee, processing fees, and response
windows for YOUR account are set by your Authorize.net /
processor agreement. Confirm them in the processor dashboard /
your account agreement (an owner hand-step in the go-live list)
and write them here once verified:

- Per-chargeback fee: _to be filled in from the account agreement_
- Card processing rate: _to be filled in from the account agreement_
- Typical dispute response window on notices: _per the notice_

## 4. Who does what

- Refund: owner, manually, in Authorize.net (above).
- Chargeback response: owner, manually, through the
  processor/acquirer (above).
- The website: records outcomes via the verified webhook only
  (paid / failed / refunded + audit rows). It never initiates a
  refund, a void, or a dispute response.
