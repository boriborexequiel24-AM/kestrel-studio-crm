# Kestrel Studio CRM

The internal CRM of Kestrel Studio, a fictional 12-person brand and performance marketing agency. It tracks who the agency sells to, the work it is trying to win, and the retainers it has signed.

## Who and what the agency sells to

**Company**:
An organization Kestrel Studio sells to or works for.
_Avoid_: Account, Customer, Organization, Lead

**Contact**:
A person at a Company.
_Avoid_: Lead, Person, User

**Client**:
A Company with at least one active Retainer. A status of a Company, not a separate record.
_Avoid_: Customer, Account

**Prospect**:
A Company with no active Retainer. A status of a Company, not a separate record.
_Avoid_: Lead

## Winning and keeping work

**Deal**:
One chance to win paid work from a Company, moving through the Pipeline.
_Avoid_: Opportunity, Lead

**Pipeline**:
The ordered Stages every Deal moves through: New, Qualified, Discovery, Proposal sent, Negotiation, then Won or Lost.
_Avoid_: Funnel, Board

**Stage**:
Where a Deal currently sits in the Pipeline.
_Avoid_: Status, Step, Phase

**Won**:
The Stage a Deal reaches when its Proposal is accepted, which creates a Retainer.
_Avoid_: Closed, Signed

**Lost**:
The Stage a Deal reaches when the Company will not go ahead, always with a Lost reason.
_Avoid_: Closed, Dead

**Lost reason**:
Why a Deal was Lost: Price, Timing, Chose another agency, Went in-house, No response or Other.
_Avoid_: Loss code, Churn reason

**New business**:
A Deal to win a Retainer that does not exist yet.
_Avoid_: New deal, Acquisition

**Renewal**:
A Deal to extend an existing Retainer before it ends.
_Avoid_: Upsell, Extension

**Owner**:
The Persona or Teammate responsible for a Deal or Retainer.
_Avoid_: Assignee, Rep

**Next step**:
The single action a Deal is waiting on, with a due date.
_Avoid_: Task, To-do, Follow-up

**Proposal**:
The offer sent to a Company for a Deal: scope, monthly fee and term. It is Draft, Sent, Accepted or Declined, and a Deal may have several over time.
_Avoid_: Quote, Pitch, Estimate

**Monthly value**:
What a Deal is expected to bring in each month: an estimate until a Proposal is sent, then that Proposal's monthly total.
_Avoid_: Deal size, Amount, MRR

**Retainer**:
A signed, recurring agreement with a Company, with a monthly fee and an end date. Active through its end date, Ends soon in its last 60 days, then Ended.
_Avoid_: Contract, Account, Subscription

**Activity**:
A recorded interaction with a Company, such as an email, call, meeting or note.
_Avoid_: Event, Interaction, Touchpoint

## The demo

**Sandbox**:
A visitor's private copy of Kestrel Studio's data, which they can change freely and which is discarded after 24 hours.
_Avoid_: Workspace, Tenant, Account

**Template**:
The fixed set of Kestrel Studio sample data that every Sandbox starts as.
_Avoid_: Seed, Demo data, Fixture

**Persona**:
The Kestrel Studio team member the visitor plays, Maya, Account Director.
_Avoid_: User, Account

**Teammate**:
A Kestrel Studio team member who owns Deals or Activities in the sample data but is not played by the visitor.
_Avoid_: User, Member

**AI action**:
One use of an AI feature by a visitor, counted against the daily cap.
_Avoid_: AI call, Credit
