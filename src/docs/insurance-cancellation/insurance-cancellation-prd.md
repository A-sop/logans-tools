# Insurance Cancellation Letter Feature PRD

**Status:** Planning — Awaiting example data structure  
**Last Updated:** 2025-02-06  
**Priority:** High (Founder Request)

---

## Overview

Enable the Executive Concierge system to draft and manage insurance cancellation letters on behalf of customers. This feature automates the creation of formal cancellation letters for various insurance types, following the existing document generation and approval workflow patterns.

**Why this matters:** Cancellation letters are a common administrative task that can be automated, saving time and ensuring consistency and compliance with formal requirements.

---

## User Flow

### Executive/Assistant Perspective

1. **Create cancellation request:**
   - Navigate to assignment/client workspace
   - Select "Create Cancellation Letter" action
   - Fill in insurance details form (see Data Requirements below)
   - Submit for drafting

2. **Review draft:**
   - System generates draft letter using OpenAI
   - Draft appears in workspace with preview
   - Executive/Assistant reviews content
   - Can edit draft if needed

3. **Approval workflow:**
   - Draft requires approval (per existing approval system)
   - Assistant or Executive approves
   - Once approved, letter can be exported or sent

4. **Export/Send:**
   - Export as PDF or DOCX (DIN-compliant format)
   - Option to send directly to insurance company (if email available)
   - Letter stored in assignment documents

### Customer Perspective (Future)

- View cancellation requests in their portal
- Approve cancellation before sending
- Track status of cancellation requests

---

## Data Requirements

### Required Fields (Minimum Viable)

Based on typical insurance cancellation letter requirements:

1. **Insurance Information:**
   - Insurance type/category (dropdown or text)
   - Insurance company name (text)
   - Policy/Contract number (text)
   - Policy start date (date, optional)
   - Policy end date (date, optional)

2. **Customer Information:**
   - Customer name (from assignment/client)
   - Customer address (from assignment/client)
   - Customer email (from assignment/client)
   - Customer phone (optional)

3. **Cancellation Details:**
   - Cancellation effective date (date, required)
   - Reason for cancellation (text, optional but recommended)
   - Cancellation method (mail, email, fax - default: mail)

4. **Letter Metadata:**
   - Assignment/Client reference (linked to assignment)
   - Created by (Executive/Assistant)
   - Created date (auto)
   - Status (draft, pending_approval, approved, sent, archived)

### Extended Fields (Future Enhancements)

- Premium amount (for reference)
- Payment method (if relevant)
- Refund instructions
- Replacement policy information
- Legal/compliance notes
- Template selection (different templates per insurance type)

---

## Technical Flow

### Stage 1: Data Collection

1. **Form submission:**
   - User fills in cancellation request form
   - Form validates required fields
   - Data stored in Supabase `insurance_cancellations` table
   - Status: `draft`

### Stage 2: Letter Drafting

1. **OpenAI integration:**
   - System sends insurance details + customer info to OpenAI
   - Prompt includes:
     - Insurance type and company
     - Policy number
     - Customer details
     - Cancellation date and reason
     - Language (based on input language policy)
     - Format requirements (formal letter, DIN-compliant)
   - OpenAI generates draft letter content

2. **Template application:**
   - Draft content inserted into letter template
   - Template includes:
     - Letterhead (if configured)
     - Sender information (Executive/Company)
     - Recipient (Insurance company)
     - Date
     - Subject line
     - Body (AI-generated)
     - Signature block

3. **Draft storage:**
   - Draft stored in database
   - Status: `pending_approval`
   - Preview available in UI

### Stage 3: Approval Workflow

1. **Review:**
   - Executive/Assistant reviews draft
   - Can edit draft content if needed
   - Can request regeneration

2. **Approval:**
   - Approver marks draft as approved
   - Status: `approved`
   - Letter ready for export/sending

### Stage 4: Export/Send

1. **PDF/DOCX Generation:**
   - Convert approved draft to PDF or DOCX
   - Apply DIN-compliant formatting
   - Include letterhead and signature block

2. **Sending (Optional):**
   - If insurance company email available, send via email
   - Track sent status
   - Store sent date and method

3. **Document Storage:**
   - Final letter stored in assignment documents
   - Linked to cancellation request record
   - Audit trail maintained

---

## Database Schema

### Table: `insurance_cancellations`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PRIMARY KEY | Unique identifier |
| `assignment_id` | uuid | FOREIGN KEY → assignments | Linked assignment/client |
| `user_id` | text | NOT NULL | Clerk user ID (creator) |
| `insurance_type` | text | NOT NULL | Type of insurance (e.g., "Health", "Auto", "Property") |
| `insurance_company` | text | NOT NULL | Insurance company name |
| `policy_number` | text | NOT NULL | Policy/contract number |
| `policy_start_date` | date | NULLABLE | Policy start date |
| `policy_end_date` | date | NULLABLE | Policy end date |
| `cancellation_date` | date | NOT NULL | Effective cancellation date |
| `reason` | text | NULLABLE | Reason for cancellation |
| `cancellation_method` | text | DEFAULT 'mail' | How to send (mail, email, fax) |
| `draft_content` | text | NULLABLE | AI-generated draft content |
| `final_content` | text | NULLABLE | Approved final content |
| `status` | text | NOT NULL, DEFAULT 'draft' | draft, pending_approval, approved, sent, archived |
| `approved_by` | text | NULLABLE | Clerk user ID of approver |
| `approved_at` | timestamptz | NULLABLE | Approval timestamp |
| `sent_at` | timestamptz | NULLABLE | When letter was sent |
| `sent_method` | text | NULLABLE | How it was sent (email, mail, fax) |
| `document_id` | uuid | NULLABLE | Link to generated document |
| `created_at` | timestamptz | NOT NULL, DEFAULT now() | Creation timestamp |
| `updated_at` | timestamptz | NOT NULL, DEFAULT now() | Last update timestamp |

### Indexes

- `idx_insurance_cancellations_assignment_id` on `assignment_id`
- `idx_insurance_cancellations_user_id` on `user_id`
- `idx_insurance_cancellations_status` on `status`
- `idx_insurance_cancellations_created_at` on `created_at`

### RLS Policies

- **Users can INSERT their own cancellations:** `user_id = auth.jwt()->>'sub'`
- **Users can SELECT cancellations for their assignments:** Check assignment ownership
- **Users can UPDATE their own cancellations:** `user_id = auth.jwt()->>'sub'` OR `approved_by = auth.jwt()->>'sub'`
- **No DELETE:** Cancellations are immutable once created (archive instead)

---

## Integration Points

### Existing Systems

1. **OpenAI Integration:**
   - Use existing `src/lib/openai.ts` for letter drafting
   - Extend with cancellation-specific prompt templates
   - Follow input language policy (German input → German output)

2. **Document Generation:**
   - Leverage existing letter generation system (from workspace PRD section G)
   - Use DIN-compliant templates
   - PDF/DOCX export functionality

3. **Approval Workflow:**
   - Integrate with existing approval system
   - Follow same patterns as other drafted communications

4. **Assignment/Client System:**
   - Link cancellations to assignments
   - Pull customer information from assignment contacts
   - Store generated letters in assignment documents

5. **Supabase Storage:**
   - Store cancellation requests in database
   - Link to assignments and documents
   - Maintain audit trail

### New Components Needed

1. **Cancellation Form Component:**
   - Form UI for collecting insurance details
   - Validation with Zod schemas
   - Integration with assignment/client selection

2. **Letter Preview Component:**
   - Display draft letter in UI
   - Allow editing before approval
   - Show approval status

3. **Cancellation Management UI:**
   - List view of all cancellations
   - Filter by status, assignment, insurance type
   - Status tracking and updates

---

## Implementation Stages

### Stage 0: Data Structure Planning (Current)

**Status:** In Progress

- [x] Define data requirements (this PRD)
- [ ] Review example data structure from founder (when available)
- [ ] Refine schema based on actual data
- [ ] Create final database migration

**Deliverable:** Finalized database schema ready for implementation

---

### Stage 1: Database & Schemas

**Dependencies:** Stage 0 complete

- [ ] Create Supabase migration for `insurance_cancellations` table
- [ ] Create Zod schemas for form validation (`src/lib/schemas/insurance-cancellation.ts`)
- [ ] Add RLS policies
- [ ] Test migration locally

**Deliverable:** Database ready to store cancellation requests

---

### Stage 2: Form & Data Collection

**Dependencies:** Stage 1 complete

- [ ] Create cancellation form component (`src/components/insurance-cancellation-form.tsx`)
- [ ] Create Server Action for form submission (`src/app/actions/insurance-cancellation.ts`)
- [ ] Integrate form into assignment workspace
- [ ] Add form validation and error handling

**Deliverable:** Users can create cancellation requests

---

### Stage 3: Letter Drafting with OpenAI

**Dependencies:** Stage 2 complete

- [ ] Create OpenAI prompt template for cancellation letters
- [ ] Extend `src/lib/openai.ts` with cancellation letter generation function
- [ ] Create letter template system (DIN-compliant)
- [ ] Generate draft on form submission
- [ ] Store draft in database

**Deliverable:** System generates draft cancellation letters

---

### Stage 4: Approval Workflow

**Dependencies:** Stage 3 complete

- [ ] Create letter preview component
- [ ] Add edit functionality for drafts
- [ ] Integrate with existing approval system
- [ ] Add approval actions (approve, reject, request changes)

**Deliverable:** Draft letters can be reviewed and approved

---

### Stage 5: Export & Document Generation

**Dependencies:** Stage 4 complete

- [ ] Implement PDF generation (using existing document system)
- [ ] Implement DOCX generation
- [ ] Apply DIN-compliant formatting
- [ ] Store generated documents in assignment documents
- [ ] Link documents to cancellation records

**Deliverable:** Approved letters can be exported as PDF/DOCX

---

### Stage 6: Sending & Tracking

**Dependencies:** Stage 5 complete

- [ ] Add email sending capability (if insurance company email available)
- [ ] Track sent status and method
- [ ] Update cancellation status to "sent"
- [ ] Store sent date and confirmation

**Deliverable:** Letters can be sent and tracked

---

### Stage 7: Management UI

**Dependencies:** Stage 2 complete (can be parallel with other stages)

- [ ] Create cancellation list view
- [ ] Add filtering (status, assignment, insurance type, date range)
- [ ] Add status tracking UI
- [ ] Add search functionality

**Deliverable:** Users can manage all cancellation requests

---

## Success Criteria

- ✅ Users can create cancellation requests with all required insurance details
- ✅ System generates professional, compliant cancellation letters
- ✅ Letters follow input language policy (German input → German output)
- ✅ Approval workflow ensures quality control
- ✅ Letters can be exported as PDF/DOCX with proper formatting
- ✅ Cancellation requests are linked to assignments and stored properly
- ✅ Audit trail maintained for all actions

---

## Future Enhancements

- **Template Library:** Pre-built templates for common insurance types
- **Bulk Cancellations:** Cancel multiple policies at once
- **Automated Reminders:** Remind users of pending cancellations
- **Integration with Insurance APIs:** Auto-fill policy details from insurance company APIs
- **Customer Portal:** Allow customers to request cancellations directly
- **Compliance Checking:** Validate cancellation letters against legal requirements
- **Multi-language Templates:** Templates in multiple languages (beyond input language)

---

## Open Questions

1. **Data Structure:** Awaiting example data structure from founder to refine schema
2. **Insurance Types:** What are the specific insurance types to support? (Health, Auto, Property, Life, etc.)
3. **Legal Requirements:** Are there specific legal requirements for cancellation letters in target markets?
4. **Template Variations:** Do different insurance types require different letter formats?
5. **Customer Approval:** Do customers need to approve cancellations before sending, or is Executive approval sufficient?

---

## References

- **Workspace PRD:** `src/docs/workspace-prd.md` (section G: Communications & Letters)
- **OpenAI Integration:** `src/lib/openai.ts`
- **Document Generation:** Existing letter generation system
- **Approval Workflow:** Existing approval system patterns
- **Database Patterns:** `supabase/migrations/` for schema examples
