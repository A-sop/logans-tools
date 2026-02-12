# Pricing Strategy

**Status:** Draft — In Progress  
**Last Updated:** 2026-02-09  
**Purpose:** Complete pricing strategy document covering philosophy, tiers, implementation considerations, and communication plan.

---

## 1. Pricing Philosophy

### Why We Charge From Day One

Charging from day one validates real demand. If someone pays for your product, you've validated that:
- The problem is real enough to pay for
- Your solution is valuable enough to justify the price
- You have real demand, not just interest

**Key Principles:**
- **Validation Test:** Charging from day one is your validation test. If someone pays $X/month for your product, you've validated real demand.
- **Avoid Free Products:** Free products attract users who have no commitment, cost you money without generating revenue, rarely convert to paying customers, and don't validate demand.
- **Rob Walling Philosophy:** Founder of TinySeed and organizer of MicroConf advocates charging from day one to validate real demand. Building without charging is like cooking a meal without knowing if anyone is hungry.

**References:**
- Rob Walling (TinySeed, MicroConf) — extensive content on charging from day one
- MicroConf YouTube channel — talks and discussions on this topic

### Freemium vs Free Trials

**Why We Avoid Freemium:**
- Lack of commitment: Free users have no skin in the game
- High infrastructure costs: Free users cost money to serve without generating revenue
- Low conversion rates: Converting free users to paid is extremely difficult (often 1-5%)
- Diluted focus: Free users demand features you might not want to build

**Why Free Trials Work Better:**
- **Time-Limited Trials (e.g., 7 days, 14 days):**
  - Creates urgency — users know they need to evaluate before trial ends
  - Requires commitment — user must provide payment method
  - Clear conversion path — trial ends, subscription begins
  - Validates demand — if someone starts a trial, they're interested enough to pay

- **Usage-Limited Trials (e.g., "5 widgets free, then pay"):**
  - Users experience value before hitting limit
  - Natural upgrade moment when they hit the limit
  - Clear value proposition — they've used it, now they pay to continue

**Our Approach:**
- **Day One:** Paid pricing only + compelling demo that shows value
- **Later:** Add time-limited or usage-limited free trials once we have product-market fit
- **Never:** Freemium (permanent free plan)

---

## 2. Estimated Customer Value & Value-Based Price Range

### 2.1 Assumptions for a Typical CM Operator

These numbers are **conservative ballpark figures** for one Consulting & More operator (like our blind executive), handling German bureaucracy for multiple clients.

- **Rates**
  - Executive effective rate: **€120/h**
  - Assistant fully loaded rate: **€30/h**

- **Monthly inefficiencies today**
  - Executive time lost to coordination, searching for information, re‑explaining context: **~6 h/month**
  - Assistant time lost to hunting for documents, redoing work, miscommunication: **~15 h/month**

- **Risk / friction**
  - Near‑misses or actual missed obligations (child benefit, insurance, tax, payroll, etc.) create extra firefighting, discounts, or goodwill costs.
  - Conservatively: **€600 per quarter** in “firefighting cost” → **~€200/month** averaged.

### 2.2 Estimated Monthly Value Created

**Labour waste per month (pre‑CM):**

- Executive: 6 h × €120/h = **€720**
- Assistants: 15 h × €30/h = **€450**
- **Total labour waste:** **€1,170/month**

**Risk / friction cost (pre‑CM):**

- ≈ **€200/month**

**Total addressable value per month (conservative):**

- **€1,170 + €200 ≈ €1,300/month**

Now assume CM, once properly adopted, recovers only **25–40%** of that value:

- 25% of €1,300 ≈ **€325/month**
- 40% of €1,300 ≈ **€520/month**

So a reasonable **value band** per operator setup is:

- **Estimated monthly value created:** **€325–520/month**

### 2.3 Price Range from Value Capture

If we target capturing **10–20%** of the value we create:

- 10% of €325–520 → **€32–52/month**
- 20% of €325–520 → **€65–104/month**

Given:

- Niche B2B, high‑consequence work (bureaucracy, deadlines, compliance).
- Strong fit for visually impaired operators who coordinate many partners.
- Real savings in both **time** and **stress / firefighting**.

We anchor the **main operator tier** approximately here:

- **Initial value‑based price range (main CM operator tier):**  
  **€79–99 / month per operator (including 1 assistant account)**

This range:

- Sits comfortably **inside** the €325–520/month value band.
- Leaves room below for a lighter “starter” tier and above for team / enterprise.
- Can be tightened later once we have more real client data.

---

## 3. Pricing Tiers

We have **4 tiers** in scope: Observer (cheaper), Operator (main), Captain/Instigator (premium), and CM Team (future).

### 3.1 Tier Overview

1. **CM Observer** (Cheaper tier — details TBD) — Price TBD (below Operator). Entry-level / read-only use cases. Planned.

2. **CM Operator** (Main tier)  
   - **Price target:** **€89 / month** (initial target within the €79–99 band)  
   - **Who it’s for:**  
     - A single CM operator (like our blind executive) handling bureaucracy for multiple client households.  
     - Includes **1 assistant seat** who can work inside the system.
   - **Core promise:** Centralize obligations, documents, and workflows so *any* assistant can reliably execute, even if the operator is away.

3. **CM Captain / Instigator** (Premium tier — details TBD) — Special feature implementation. Name and features TBD.

4. **CM Team** (Future – roadmap)  
   - **Price rough target:** **€179–199 / month**  
   - **Who it’s for:**  
     - Small teams (2–3 operators) with multiple assistants and higher document volume.  
   - **Status:** Documented as a **roadmap tier**; we won’t block MVP on implementing it, but design now so the pricing story is coherent.

### 3.1.1 Test discount codes (99% off)

Create a **99% off** coupon in Clerk Billing / Stripe to test real payment flow on your bank account (e.g. €89 plan → ~€0.89 charge).

> For MVP, billing is implemented for **CM Operator**. Observer, Captain/Instigator, CM Team can be added in Clerk when ready.

### 3.2 CM Operator – Details

**Price:** **€89 / month** (single billing entity; includes 1 operator + 1 assistant seat).

**Key features (initial scope):**

- **Workspace & Assignments**
  - Create and manage assignments (cases / Aufträge) per client or household.
  - Track obligations, deadlines, and statuses across all partners (insurance, Elterngeld, banks, payroll, tax).
  - Link tasks, documents, and notes to each assignment.

- **Document Intake & Organization**
  - Ingest and categorize incoming documents (PDFs, images, letters).
  - Attach documents to assignments and tasks.
  - Make it easy for any assistant to find “the right letter” quickly.

- **Task & Workflow Support**
  - Create tasks for yourself and assistants.
  - Basic workflows for recurring obligations (monthly payroll, quarterly tax, renewals).
  - Clear ownership and due dates so things don’t get lost.

- **Accessibility & Assistant Collaboration**
  - Interface suitable for screen‑reader workflows (where possible within MVP).
  - 1 assistant seat included: assistants can log in and execute tasks against the shared system.

**Value alignment with Section 2:**

- Operator value band: **€325–520/month** saved/created.
- Captured value at €89/month ≈ **17–27%** of the lower bound (325), and **~17%** of the mid‑band (~520), which is well within the 10–20% capture goal.

### 3.3 CM Team – Outline (Roadmap)

**Price (tentative):** **€179–199 / month**

**Who it’s for:**

- Offices with **2–3 operators** and multiple assistants.
- Needs:
  - More assignments and document throughput.
  - Better separation of responsibilities.
  - Shared templates and workflows across operators.

**Feature deltas vs. CM Operator (conceptual):**

- Higher limits on:
  - Active assignments.
  - Stored documents.
  - Connected clients/households.
- Additional seats:
  - Up to 3 operators.
  - More assistant seats.
- Team‑level features (later):
  - Shared templates and workflows.
  - Simple reporting across operators.

> We do **not** need to fully specify limits yet. For now, it is enough that:  
> - CM Operator is clearly “single‑operator + 1 assistant”.  
> - CM Team is “multiple operators + more assistants and volume”, at ~2× Operator price.  
> Detailed limits can be tuned once we have real usage data.

---

## 4. Implementation Considerations

### Standard SaaS Patterns (✅ Recommended for MVP)

- ✅ **Recurring subscriptions:** Monthly or annual billing cycles (most common SaaS pattern)
- ✅ **Tiered plans:** 2-3 clear tiers with feature-based differentiation (Starter, Pro, Enterprise)
- ✅ **Free trials:** Time-limited trials (e.g., 7 days, 14 days) that convert to paid subscriptions
- ✅ **Usage-limited trials:** Allow a certain number of uses for free, then require payment
- ✅ **Single currency:** Start with one currency (typically USD) to keep implementation simple
- ✅ **Feature-based tiers:** Different plans unlock different features (easier to implement than usage-based)

### Patterns to Avoid for MVP (⚠️ Save for Later)

- ⚠️ **Multi-currency pricing:** Requires additional complexity in billing setup (start with one currency)
- ⚠️ **Custom pricing per customer:** Enterprise deals with unique pricing require manual setup or custom development
- ⚠️ **Usage-based/metered billing:** Charging based on usage requires tracking and calculating usage—more complex than fixed tiers
- ⚠️ **Per-seat pricing:** Variable pricing based on number of users requires seat tracking (can add later)
- ⚠️ **Complex tax handling:** Multiple tax jurisdictions add complexity (start simple)

### Why This Matters

Standard pricing patterns are:
- **Faster to implement** (you'll set up billing in later lessons)
- **Easier to maintain** (less custom code)
- **More familiar to users** (they understand tiered subscriptions)
- **Easier to explain** (clear value proposition)
- **Lower risk** (proven patterns work)

You can always add advanced features later (multi-currency, usage-based billing, custom pricing) once you have revenue and validated demand. For now, focus on getting to revenue with simple, clear pricing.

---

## 5. Communication Plan

**Note:** [LDW] — Requires human input to define:
- Key messaging for pricing page
- Value propositions for each tier
- How to explain pricing to users

**Placeholder:**
- Pricing page messaging: TBD
- Value statements: TBD
- User communication: TBD

---

## Next Steps

1. [LDW] Complete customer value estimation (Section 2)
2. [LDW] Define pricing tiers with feature mapping (Section 3)
3. [LDW] Create communication plan (Section 5)
4. Review pricing against easy-to-implement patterns (Section 4) — ✅ Complete
5. Document complete pricing strategy — In progress

---

**Related Issues:**
- A-26: Pricing Philosophy (✅ Complete)
- A-27: Value-Based Pricing — [LDW] Requires human input
- A-28: Design Pricing Tiers — [LDW] Requires human input
- A-29: Ensure Pricing Uses Simple Patterns (✅ Complete)
- A-30: Write Complete Pricing Strategy Document (In progress)
