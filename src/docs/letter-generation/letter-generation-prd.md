# Document & Form Generation Tool PRD

**Status:** Planning — Awaiting example data structure  
**Last Updated:** 2025-02-06  
**Priority:** High (Founder Request)

---

## Overview

Enable the Executive Concierge system to draft, manage, and deliver formal documents, letters, and legal forms on behalf of clients in a family office / full-service model. The system generates professional documents (letters, forms like Vollmacht, and custom documents with customizable wording), sends them to clients for signature via WhatsApp or email, and manages the complete workflow from draft to signed delivery.

**Why this matters:** Family offices handle numerous administrative documents, letters, and legal forms on behalf of clients. Automating document generation, template management, approval workflows, and client signature collection streamlines operations while maintaining quality and compliance.

**Document Types:**

1. **Letters:**
   - Insurance cancellation letters
   - Formal correspondence with authorities
   - Business communications
   - Contract-related letters
   - Any formal letter requiring client signature

2. **Forms (Legal Documents):**
   - **Vollmacht (Power of Attorney):**
     - Specific Vollmacht for various activities (e.g., banking, property, tax, business)
     - General Vollmacht (allgemeine Vollmacht)
   - Other legal forms (to be added)

3. **Custom Documents:**
   - Documents with customizable wording/templates
   - Template library for common document types
   - User-defined templates

---

## User Flow

### Executive/Assistant Perspective

1. **Create document/letter/form request:**
   - Navigate to assignment/client workspace
   - Select "Create Document" action
   - Choose document type:
     - **Letter** (Insurance Cancellation, Authority Correspondence, Business Letter, Custom)
     - **Form** (Vollmacht - Specific, Vollmacht - General, Other forms)
     - **Custom Document** (with template selection)
   - Fill in document details form (recipient, subject, context, form-specific fields, etc.)
   - Select template (if multiple templates available for type)
   - Submit for drafting

2. **Review draft:**
   - System generates draft using:
     - **AI-powered drafting** (OpenAI) for letters and custom documents
     - **Template-based generation** for forms (like Vollmacht) with field population
   - Draft appears in workspace with preview
   - Executive/Assistant reviews content
   - Can edit draft if needed (including template wording)
   - Can request regeneration
   - Can switch templates (if multiple available)

3. **Template management (for documents with wording):**
   - View and edit template wording
   - Save custom templates
   - Manage template library
   - Preview template with sample data

4. **Internal approval workflow:**
   - Draft requires internal approval (per existing approval system)
   - Assistant or Executive approves
   - Once approved, document ready for client signature

5. **Generate PDF and send to client:**
   - System generates PDF (DIN-compliant format)
   - Executive/Assistant selects delivery method:
     - **WhatsApp** (if client WhatsApp number available)
     - **Email** (if client email available)
   - PDF sent to client with instructions for signature
   - Status: `pending_client_signature`

6. **Track signature:**
   - System tracks when client receives document
   - Client signs document (digitally or physically)
   - Client uploads signed PDF or confirms signature
   - Status: `signed`

7. **Final delivery (optional):**
   - After signature, document can be sent to recipient
   - Or client handles final delivery themselves
   - Status: `delivered` or `completed`

### Client Perspective

1. **Receive document:**
   - Client receives PDF via WhatsApp or Email
   - Document includes clear instructions for signature
   - Link to view document in portal (if available)

2. **Sign document:**
   - Client signs PDF (digital signature or print/sign/scan)
   - Client uploads signed PDF or confirms signature
   - Or client confirms signature via WhatsApp/Email reply

3. **Track status:**
   - Client can see document status in portal
   - Notifications when document is sent to recipient

---

## Data Requirements

### Document Metadata

1. **Document Type:**
   - Document category: Letter, Form, Custom Document
   - Specific type (dropdown):
     - **Letters:** Insurance Cancellation, Authority Correspondence, Business Letter, Custom
     - **Forms:** Vollmacht - Specific Activity, Vollmacht - General, Other forms
     - **Custom Documents:** User-defined types
   - Template selection (if multiple templates per type)

2. **Recipient Information:**
   - Recipient name (text, required for letters, optional for forms)
   - Recipient organization/company (text, optional)
   - Recipient address (text, required for formal letters)
   - Recipient email (text, optional)
   - Recipient phone/WhatsApp (text, optional)

3. **Document Content:**
   - Subject/title (text, required)
   - Context/background (text, optional - used for AI drafting)
   - Specific requirements (text, optional - e.g., "mention policy number XYZ")
   - Language (auto-detected from input or manual selection)
   - Template wording (editable text, for documents with templates)

4. **Form-Specific Fields (e.g., Vollmacht):**
   - **Vollmacht Type:**
     - Specific activity (dropdown: Banking, Property, Tax, Business, Legal, Other)
     - General Vollmacht (allgemeine Vollmacht)
   - **Grantor (Vollmachtgeber):** Client information (from assignment)
   - **Grantee (Bevollmächtigter):** Person receiving power of attorney
   - **Scope/Activities:** Specific activities covered (for specific Vollmacht)
   - **Validity Period:** Start date, end date (optional)
   - **Limitations:** Any limitations or restrictions
   - **Witness Requirements:** Whether witnesses needed (legal requirement)

4. **Client Information:**
   - Client/assignment reference (linked to assignment)
   - Client name (from assignment/client)
   - Client address (from assignment/client)
   - Client email (from assignment/client)
   - Client WhatsApp number (from assignment/client)

5. **Delivery & Signature:**
   - Delivery method to client (WhatsApp, Email - required)
   - Signature method (Digital, Physical upload, Confirmation - required)
   - Delivery method to recipient (Email, Mail, Client handles - optional)

6. **Status Tracking:**
   - Status (draft, pending_approval, approved, pending_client_signature, signed, delivered, completed, archived)
   - Created by (Executive/Assistant)
   - Approved by (Executive/Assistant)
   - Sent to client at (timestamp)
   - Signed at (timestamp)
   - Delivered to recipient at (timestamp)

### Document-Specific Data (Examples)

**Insurance Cancellation Letter:**
- Insurance type/category
- Insurance company name
- Policy/Contract number
- Cancellation effective date
- Reason for cancellation (optional)

**Authority Correspondence Letter:**
- Authority name
- Reference number
- Subject matter
- Required attachments

**Business Letter:**
- Business context
- Contract/agreement reference
- Action required

**Vollmacht (Power of Attorney) Form:**
- Vollmacht type (specific activity or general)
- Grantor (Vollmachtgeber) - Client information
- Grantee (Bevollmächtigter) - Person receiving power
- Specific activities (if specific Vollmacht)
- Validity period
- Limitations
- Witness requirements

**Custom Document:**
- Template selection
- Custom fields (defined by template)
- Editable wording/template content

---

## Technical Flow

### Stage 1: Letter Creation & Drafting

1. **Form submission:**
   - User fills in letter request form
   - Form validates required fields
   - Data stored in Supabase `letters` table
   - Status: `draft`

2. **AI Drafting:**
   - System sends letter details + context to OpenAI
   - Prompt includes:
     - Letter type and template
     - Recipient information
     - Client information
     - Context and requirements
     - Language (follows input language policy)
     - Format requirements (formal letter, DIN-compliant)
   - OpenAI generates draft letter content

3. **Template application:**
   - Draft content inserted into letter template
   - Template includes:
     - Letterhead (if configured)
     - Sender information (Executive/Company)
     - Recipient (from form)
     - Date
     - Subject line
     - Body (AI-generated)
     - Signature block (for client signature)

4. **Draft storage:**
   - Draft stored in database
   - Status: `pending_approval`
   - Preview available in UI

### Stage 2: Internal Approval

1. **Review:**
   - Executive/Assistant reviews draft
   - Can edit draft content if needed
   - Can request regeneration

2. **Approval:**
   - Approver marks draft as approved
   - Status: `approved`
   - Letter ready for PDF generation

### Stage 3: PDF Generation & Client Delivery

1. **PDF Generation:**
   - Convert approved draft to PDF
   - Apply DIN-compliant formatting
   - Include letterhead and signature block
   - Store PDF in document storage

2. **Send to Client:**
   - **WhatsApp delivery:**
     - Use WhatsApp Business API or Twilio
     - Send PDF with message: "Please review and sign this letter. [Link to portal if available]"
     - Track delivery status
   - **Email delivery:**
     - Use email service (Resend, SendGrid, or n8n)
     - Send PDF as attachment
     - Include instructions for signature
     - Track delivery status

3. **Status update:**
   - Status: `pending_client_signature`
   - `sent_to_client_at` timestamp set
   - Notification sent to Executive/Assistant

### Stage 4: Client Signature

1. **Signature collection:**
   - **Digital signature:**
     - Client signs via portal (e-signature integration)
     - Signed PDF generated automatically
   - **Physical signature:**
     - Client prints, signs, scans PDF
     - Client uploads signed PDF via portal or WhatsApp
   - **Confirmation:**
     - Client confirms signature via WhatsApp/Email reply
     - Executive/Assistant marks as signed

2. **Signed PDF storage:**
   - Store signed PDF in document storage
   - Link to letter record
   - Status: `signed`
   - `signed_at` timestamp set

### Stage 5: Final Delivery (Optional)

1. **Send to recipient:**
   - If configured, send signed letter to recipient
   - **Email:** Send signed PDF to recipient email
   - **Mail:** Generate mailing instructions or integrate with mail service
   - **Client handles:** Mark as completed, client sends themselves

2. **Completion:**
   - Status: `delivered` or `completed`
   - `delivered_at` timestamp set
   - All documents stored in assignment

---

## Database Schema

### Table: `documents` (renamed from `letters` to reflect broader scope)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PRIMARY KEY | Unique identifier |
| `assignment_id` | uuid | FOREIGN KEY → assignments | Linked assignment/client |
| `user_id` | text | NOT NULL | Clerk user ID (creator) |
| `document_category` | text | NOT NULL | letter, form, custom_document |
| `document_type` | text | NOT NULL | Specific type (insurance_cancellation, vollmacht_specific, vollmacht_general, etc.) |
| `template_id` | uuid | FOREIGN KEY → document_templates | Template identifier |
| `subject` | text | NOT NULL | Document subject/title |
| `context` | text | NULLABLE | Background context for AI drafting |
| `requirements` | text | NULLABLE | Specific requirements for document |
| `language` | text | DEFAULT 'de' | Language (en, de) - defaults to German for forms |
| `template_content` | text | NULLABLE | Editable template wording/content |
| `recipient_name` | text | NOT NULL | Recipient name |
| `recipient_organization` | text | NULLABLE | Recipient organization/company |
| `recipient_address` | text | NOT NULL | Recipient address |
| `recipient_email` | text | NULLABLE | Recipient email |
| `recipient_phone` | text | NULLABLE | Recipient phone/WhatsApp |
| `draft_content` | text | NULLABLE | AI-generated draft content |
| `final_content` | text | NULLABLE | Approved final content |
| `status` | text | NOT NULL, DEFAULT 'draft' | draft, pending_approval, approved, pending_client_signature, signed, delivered, completed, archived |
| `approved_by` | text | NULLABLE | Clerk user ID of approver |
| `approved_at` | timestamptz | NULLABLE | Approval timestamp |
| `client_delivery_method` | text | NOT NULL | WhatsApp or Email |
| `sent_to_client_at` | timestamptz | NULLABLE | When sent to client |
| `signature_method` | text | NOT NULL | digital, physical_upload, confirmation |
| `signed_at` | timestamptz | NULLABLE | When client signed |
| `signed_pdf_id` | uuid | NULLABLE | Link to signed PDF document |
| `recipient_delivery_method` | text | NULLABLE | email, mail, client_handles |
| `delivered_at` | timestamptz | NULLABLE | When delivered to recipient |
| `draft_pdf_id` | uuid | NULLABLE | Link to draft PDF |
| `created_at` | timestamptz | NOT NULL, DEFAULT now() | Creation timestamp |
| `updated_at` | timestamptz | NOT NULL, DEFAULT now() | Last update timestamp |

### Document-Specific Data (JSONB)

For document-type-specific fields (like insurance policy numbers, Vollmacht details), we'll use a JSONB column:

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `document_data` | jsonb | NULLABLE | Type-specific data (e.g., insurance details, Vollmacht fields, authority reference numbers) |

**Example `document_data` for insurance cancellation letter:**
```json
{
  "insurance_type": "Health",
  "insurance_company": "ABC Insurance",
  "policy_number": "POL-123456",
  "cancellation_date": "2025-03-01",
  "reason": "Switching providers"
}
```

**Example `document_data` for Vollmacht (Specific):**
```json
{
  "vollmacht_type": "specific",
  "activity": "banking",
  "grantee_name": "Max Mustermann",
  "grantee_address": "Musterstraße 1, 12345 Berlin",
  "specific_activities": ["Account management", "Wire transfers", "Investment decisions"],
  "validity_start": "2025-03-01",
  "validity_end": "2026-03-01",
  "limitations": "Maximum transaction amount: €50,000",
  "witness_required": true
}
```

**Example `document_data` for Vollmacht (General):**
```json
{
  "vollmacht_type": "general",
  "grantee_name": "Max Mustermann",
  "grantee_address": "Musterstraße 1, 12345 Berlin",
  "validity_start": "2025-03-01",
  "validity_end": null,
  "limitations": null,
  "witness_required": true
}
```

### Table: `document_templates`

For managing document templates and wording:

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PRIMARY KEY | Unique identifier |
| `name` | text | NOT NULL | Template name |
| `document_category` | text | NOT NULL | letter, form, custom_document |
| `document_type` | text | NOT NULL | Specific type this template is for |
| `language` | text | NOT NULL | Language (en, de) |
| `template_content` | text | NOT NULL | Template wording/content with placeholders |
| `placeholders` | jsonb | NULLABLE | List of placeholders and their descriptions |
| `is_default` | boolean | DEFAULT false | Is this the default template for this type? |
| `is_system` | boolean | DEFAULT false | Is this a system template (not user-editable)? |
| `created_by` | text | NULLABLE | Clerk user ID (null for system templates) |
| `created_at` | timestamptz | NOT NULL, DEFAULT now() | Creation timestamp |
| `updated_at` | timestamptz | NOT NULL, DEFAULT now() | Last update timestamp |

**Example template content with placeholders:**
```
Vollmacht für {{activity_name}}

Ich, {{grantor_name}}, geb. am {{grantor_birthdate}}, wohnhaft {{grantor_address}}, 
erteile hiermit {{grantee_name}}, wohnhaft {{grantee_address}}, 
eine Vollmacht für folgende Tätigkeiten:
{{specific_activities_list}}

Gültigkeitsdauer: {{validity_start}} bis {{validity_end}}
Einschränkungen: {{limitations}}

Ort, Datum: {{location}}, {{date}}
Unterschrift Vollmachtgeber: _________________

Zeugen:
1. {{witness1_name}}, _________________
2. {{witness2_name}}, _________________
```

### Indexes

- `idx_documents_assignment_id` on `assignment_id`
- `idx_documents_user_id` on `user_id`
- `idx_documents_status` on `status`
- `idx_documents_document_type` on `document_type`
- `idx_documents_document_category` on `document_category`
- `idx_documents_created_at` on `created_at`
- `idx_documents_sent_to_client_at` on `sent_to_client_at`
- `idx_document_templates_document_type` on `document_type`
- `idx_document_templates_language` on `language`

### RLS Policies

**For `documents` table:**
- **Users can INSERT their own documents:** `user_id = auth.jwt()->>'sub'`
- **Users can SELECT documents for their assignments:** Check assignment ownership
- **Users can UPDATE their own documents:** `user_id = auth.jwt()->>'sub'` OR `approved_by = auth.jwt()->>'sub'`
- **No DELETE:** Documents are immutable once created (archive instead)

**For `document_templates` table:**
- **Users can SELECT all templates:** All authenticated users can view templates
- **Users can INSERT custom templates:** `created_by = auth.jwt()->>'sub'`
- **Users can UPDATE their own templates:** `created_by = auth.jwt()->>'sub'` AND `is_system = false`
- **System templates:** Only admins can modify (`is_system = true`)

---

## Integration Points

### Existing Systems

1. **OpenAI Integration:**
   - Use existing `src/lib/openai.ts` for letter drafting
   - Extend with letter-type-specific prompt templates
   - Follow input language policy (German input → German output)

2. **Document Generation:**
   - Leverage existing letter generation system (from workspace PRD section G)
   - Use DIN-compliant templates
   - PDF generation (existing or new library)

3. **Approval Workflow:**
   - Integrate with existing approval system
   - Follow same patterns as other drafted communications

4. **Assignment/Client System:**
   - Link letters to assignments
   - Pull client information from assignment contacts
   - Store generated letters in assignment documents

5. **Supabase Storage:**
   - Store letters in database
   - Store PDFs in Supabase Storage or document storage
   - Link to assignments and documents
   - Maintain audit trail

### New Integrations Needed

1. **WhatsApp Integration:**
   - WhatsApp Business API or Twilio WhatsApp API
   - Send PDFs via WhatsApp
   - Track delivery and read receipts
   - Handle client replies

2. **Email Service:**
   - Resend, SendGrid, or n8n email integration
   - Send PDFs as attachments
   - Track delivery status
   - Handle client replies

3. **Digital Signature (Future):**
   - E-signature service integration (DocuSign, HelloSign, etc.)
   - Or build simple signature capture in portal
   - Generate signed PDFs

4. **PDF Generation:**
   - Library for PDF generation (react-pdf, pdfkit, puppeteer)
   - Apply DIN-compliant formatting
   - Include letterhead and signature blocks

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

### Stage 1: Database & Core Schemas

**Dependencies:** Stage 0 complete

- [ ] Create Supabase migration for `documents` table (renamed from `letters`)
- [ ] Create Supabase migration for `document_templates` table
- [ ] Create Zod schemas for form validation (`src/lib/schemas/document.ts`)
- [ ] Create Zod schemas for template management (`src/lib/schemas/document-template.ts`)
- [ ] Add RLS policies
- [ ] Test migration locally

**Deliverable:** Database ready to store documents and templates

---

### Stage 2: Template Management System

**Dependencies:** Stage 1 complete

- [ ] Create template management UI (`src/components/document-template-manager.tsx`)
- [ ] Create Server Actions for template CRUD (`src/app/actions/document-template.ts`)
- [ ] Add template wording editor
- [ ] Support template versioning
- [ ] Support multiple languages per template
- [ ] Mark templates as active/inactive

**Deliverable:** Users can manage template wording libraries

---

### Stage 3: Document Creation & Drafting

**Dependencies:** Stage 1 and 2 complete

- [ ] Create document form component (`src/components/document-form.tsx`)
- [ ] Support different form fields based on document type
- [ ] Create Server Action for form submission (`src/app/actions/document.ts`)
- [ ] Extend OpenAI integration with document drafting function
- [ ] Integrate template wording into drafting process
- [ ] Create document templates (DIN-compliant)
- [ ] Generate draft on form submission
- [ ] Store draft in database

**Deliverable:** Users can create documents/letters/forms and system generates drafts using template wording

---

### Stage 4: Approval Workflow

**Dependencies:** Stage 2 complete

- [ ] Create letter preview component
- [ ] Add edit functionality for drafts
- [ ] Integrate with existing approval system
- [ ] Add approval actions (approve, reject, request changes)

**Deliverable:** Draft letters can be reviewed and approved internally

---

### Stage 5: PDF Generation

**Dependencies:** Stage 3 complete

- [ ] Implement PDF generation library
- [ ] Apply DIN-compliant formatting
- [ ] Include letterhead and signature blocks
- [ ] Store PDFs in document storage
- [ ] Link PDFs to letter records

**Deliverable:** Approved letters can be exported as PDFs

---

### Stage 6: Client Delivery (WhatsApp & Email)

**Dependencies:** Stage 4 complete

- [ ] Integrate WhatsApp API (Twilio or WhatsApp Business)
- [ ] Integrate email service (Resend, SendGrid, or n8n)
- [ ] Create delivery selection UI
- [ ] Send PDFs to clients via selected method
- [ ] Track delivery status
- [ ] Update letter status to `pending_client_signature`

**Deliverable:** PDFs can be sent to clients via WhatsApp or Email

---

### Stage 7: Signature Collection

**Dependencies:** Stage 5 complete

- [ ] Create signature upload UI (for physical signatures)
- [ ] Integrate digital signature service (or build simple capture)
- [ ] Handle signature confirmation via WhatsApp/Email
- [ ] Store signed PDFs
- [ ] Update letter status to `signed`

**Deliverable:** Clients can sign letters and signed PDFs are stored

---

### Stage 8: Final Delivery & Management

**Dependencies:** Stage 6 complete

- [ ] Add recipient delivery options
- [ ] Send signed letters to recipients (if configured)
- [ ] Create letter management UI (list, filter, search)
- [ ] Add status tracking and notifications
- [ ] Archive completed letters

**Deliverable:** Complete letter workflow from creation to delivery

---

## Success Criteria

- ✅ Users can create documents, letters, and forms of various types with all required details
- ✅ Template wording library system allows customization and versioning
- ✅ System generates professional, compliant documents using AI and template wording
- ✅ Documents follow input language policy (German input → German output)
- ✅ Forms (like Vollmacht) include all required legal fields and structure
- ✅ Internal approval workflow ensures quality control
- ✅ PDFs are generated with DIN-compliant formatting
- ✅ PDFs include fillable fields for forms where applicable
- ✅ Documents can be sent to clients via WhatsApp or Email
- ✅ Clients can sign documents (digitally or physically)
- ✅ Signed documents can be delivered to recipients
- ✅ Complete audit trail maintained for all actions
- ✅ Documents are linked to assignments and stored properly

---

## Future Enhancements

- **Template Library:** Pre-built templates for common document types (letters, Vollmacht, etc.)
- **Template Marketplace:** Share templates across accounts (future)
- **Bulk Operations:** Generate multiple documents at once
- **Automated Reminders:** Remind clients of pending signatures
- **Advanced Digital Signatures:** Full e-signature workflow with legal validity
- **Client Portal:** Dedicated portal for clients to view and sign documents
- **Multi-language Templates:** Templates in multiple languages (beyond input language)
- **Integration with Mail Services:** Direct mail sending (Deutsche Post, etc.)
- **Compliance Checking:** Validate documents against legal requirements
- **Document Analytics:** Track document types, response times, signature rates
- **Form Field Validation:** Legal compliance validation for form fields
- **Template Inheritance:** Base templates with variations
- **Wording Suggestions:** AI suggestions for improving template wording

---

## Open Questions

1. **Data Structure:** Awaiting example data structure from founder to refine schema
2. **WhatsApp Service:** Which WhatsApp API to use? (Twilio, WhatsApp Business API, other)
3. **Email Service:** Which email service? (Resend, SendGrid, n8n, other)
4. **Digital Signature:** Build simple signature capture or integrate service? (DocuSign, HelloSign, etc.)
5. **PDF Library:** Which PDF generation library? (react-pdf, pdfkit, puppeteer)
6. **Document Types:** What are the specific document types to support initially? (beyond Vollmacht)
7. **Vollmacht Types:** What are the specific Vollmacht types needed? (beyond specific and general)
8. **Template Wording:** Who can edit template wording? (Executive only, Assistant, both?)
9. **Legal Requirements:** Are there specific legal requirements for documents/forms in target markets?
10. **Form Fields:** For Vollmacht and other forms, which fields are required vs optional?
11. **Client Portal:** Do clients need a portal, or is WhatsApp/Email sufficient?
12. **Wording Library:** Should wording be shared across accounts or per-account?

---

## References

- **Workspace PRD:** `src/docs/workspace-prd.md` (section G: Communications & Letters)
- **OpenAI Integration:** `src/lib/openai.ts`
- **Document Generation:** Existing letter generation system
- **Approval Workflow:** Existing approval system patterns
- **Database Patterns:** `supabase/migrations/` for schema examples
- **WhatsApp Integration:** [Twilio WhatsApp API](https://www.twilio.com/docs/whatsapp), [WhatsApp Business API](https://developers.facebook.com/docs/whatsapp)
- **Email Services:** [Resend](https://resend.com), [SendGrid](https://sendgrid.com), n8n email nodes
