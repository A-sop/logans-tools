# Letter Generation Tool (Including Insurance Cancellations)

**Status:** Planning — Awaiting example data structure  
**Priority:** High (Founder Request)  
**Note:** This feature has been expanded to a general letter generation tool for family office operations.

---

## Overview

This feature enables the Executive Concierge system to draft, manage, and deliver formal letters on behalf of clients in a family office / full-service model. The system generates professional letters (including but not limited to insurance cancellations), sends them to clients for signature via WhatsApp or email, and manages the complete workflow from draft to signed delivery.

**See:** [letter-generation-prd.md](../letter-generation/letter-generation-prd.md) for the complete PRD.

---

## Documentation

- **PRD:** [insurance-cancellation-prd.md](./insurance-cancellation-prd.md) — Complete product requirements document

---

## Current Status

**Stage 0: Data Structure Planning**

We're currently awaiting example data structure from the founder to refine the database schema. Once we have the example data/table headers, we'll:

1. Review the data structure
2. Refine the database schema in the PRD
3. Create the implementation plan
4. Begin Stage 1 (Database & Schemas)

---

## Key Requirements (Initial)

### Data Fields Needed

- Insurance type/category
- Insurance company name
- Policy/Contract number
- Cancellation effective date
- Customer information (from assignment/client)
- Reason for cancellation (optional)

### Integration Points

- **OpenAI:** For drafting letter content
- **Document Generation:** Existing DIN-compliant letter system
- **Approval Workflow:** Existing approval system
- **Assignments:** Link to client/assignment system
- **Supabase:** Store cancellation requests and generated letters

---

## Next Steps

1. **Await example data structure** from founder
2. **Review and refine** database schema based on actual data
3. **Create implementation plan** with specific stages
4. **Begin development** starting with database migration

---

## Questions for Founder

1. What are the specific insurance types to support? (Health, Auto, Property, Life, etc.)
2. Are there specific legal requirements for cancellation letters?
3. Do different insurance types require different letter formats?
4. Do customers need to approve cancellations before sending?
