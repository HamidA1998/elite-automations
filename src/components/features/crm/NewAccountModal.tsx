import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export interface NewAccountPayload {
  businessName: string;
  businessType: string;
  area: string;
  websiteUrl?: string | null;
  phoneNumber?: string | null;
  emailAddress?: string | null;
  address?: string | null;
  googleRating?: number | null;
  reviewCount?: number | null;
  accountStatus?: string;
  priority?: string;
  nextActionNotes?: string;
  dueDate?: string | null;
  dealValue?: number;
  siteScore?: number;
  sourceNotes?: string;
}

interface NewAccountModalProps {
  open: boolean;
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (payload: NewAccountPayload) => Promise<void> | void;
}

const businessTypes = [
  "Restaurant/Takeaway",
  "Dental Practice",
  "Hair Salon/Barber",
  "Beauty Salon/Nail Bar",
  "Plumber",
  "Electrician",
  "Builder/Construction",
  "Roofing Company",
  "Landscaping/Gardening",
  "Car Garage/Mechanic",
  "MOT Centre",
  "Solicitor/Law Firm",
  "Accountant",
  "Estate Agent",
  "Letting Agent",
  "Cleaning Company",
  "Removal Company",
  "Gym/Personal Trainer",
  "Physiotherapist/Chiropractor",
  "Optician",
  "Vet",
  "Driving Instructor",
  "Wedding Photographer",
  "Printing Company",
  "Signage Company",
  "Other",
];

const areas = [
  "Chadderton",
  "Oldham",
  "Rochdale",
  "Bury",
  "Stockport",
  "Bolton",
  "Salford",
  "Manchester City Centre",
  "Ashton-under-Lyne",
  "Middleton",
  "Failsworth",
  "Droylsden",
  "Other Greater Manchester",
];

const statuses = [
  { label: "Researched", value: "researched" },
  { label: "Ready to Send", value: "ready-to-send" },
  { label: "Contacted", value: "contacted" },
  { label: "In Follow-up", value: "in-follow-up" },
  { label: "Replied", value: "replied" },
  { label: "Proposal", value: "proposal" },
  { label: "Won", value: "won" },
  { label: "Lost", value: "lost" },
];

const priorities = [
  { label: "Critical", value: "high" },
  { label: "High", value: "high" },
  { label: "Medium", value: "medium" },
  { label: "Low", value: "low" },
];

function fieldClassName() {
  return "min-h-12 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 text-[var(--color-text)] outline-none transition-all duration-[var(--duration-base)] ease-[var(--ease-out)] focus:border-[var(--color-accent)] focus:shadow-[0_0_0_4px_rgba(99,102,241,0.16)]";
}

export function NewAccountModal({ open, isSubmitting = false, onClose, onSubmit }: NewAccountModalProps) {
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState(businessTypes[0]);
  const [area, setArea] = useState(areas[0]);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [emailAddress, setEmailAddress] = useState("");
  const [address, setAddress] = useState("");
  const [googleRating, setGoogleRating] = useState("");
  const [reviewCount, setReviewCount] = useState("");
  const [accountStatus, setAccountStatus] = useState(statuses[0].value);
  const [priority, setPriority] = useState(priorities[2].value);
  const [nextActionNotes, setNextActionNotes] = useState("Research contacts and build a demo brief.");
  const [dueDate, setDueDate] = useState("");
  const [dealValue, setDealValue] = useState("");
  const [siteScore, setSiteScore] = useState("");
  const [sourceNotes, setSourceNotes] = useState("");
  const [error, setError] = useState("");

  const canSubmit = useMemo(() => businessName.trim().length >= 2, [businessName]);

  const reset = () => {
    setBusinessName("");
    setBusinessType(businessTypes[0]);
    setArea(areas[0]);
    setWebsiteUrl("");
    setPhoneNumber("");
    setEmailAddress("");
    setAddress("");
    setGoogleRating("");
    setReviewCount("");
    setAccountStatus(statuses[0].value);
    setPriority(priorities[2].value);
    setNextActionNotes("Research contacts and build a demo brief.");
    setDueDate("");
    setDealValue("");
    setSiteScore("");
    setSourceNotes("");
    setError("");
  };

  const handleClose = () => {
    if (isSubmitting) return;
    setError("");
    onClose();
  };

  const handleSubmit = async () => {
    if (!canSubmit) {
      setError("Business name is required.");
      return;
    }
    setError("");
    try {
      await onSubmit({
        businessName: businessName.trim(),
        businessType,
        area,
        websiteUrl: websiteUrl.trim() || null,
        phoneNumber: phoneNumber.trim() || null,
        emailAddress: emailAddress.trim() || null,
        address: address.trim() || null,
        googleRating: googleRating ? Number(googleRating) : null,
        reviewCount: reviewCount ? Number(reviewCount) : null,
        accountStatus,
        priority,
        nextActionNotes: nextActionNotes.trim(),
        dueDate: dueDate || null,
        dealValue: dealValue ? Number(dealValue) : 0,
        siteScore: siteScore ? Number(siteScore) : 0,
        sourceNotes: sourceNotes.trim(),
      });
      reset();
      onClose();
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Unable to create account.");
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      eyebrow="CRM"
      title="New account"
      description="Create a real account record in the main workspace. This writes directly to SQLite, opens cleanly in the React app, and keeps the CRM truthful."
      size="full"
    >
      <div className="grid gap-8 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <Input label="Business name" value={businessName} onChange={(event) => setBusinessName(event.target.value)} placeholder="Elite Dental Oldham" />
            <label className="flex flex-col gap-2">
              <span className="section-kicker">Business type</span>
              <select className={fieldClassName()} value={businessType} onChange={(event) => setBusinessType(event.target.value)}>
                {businessTypes.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-2">
              <span className="section-kicker">Area</span>
              <select className={fieldClassName()} value={area} onChange={(event) => setArea(event.target.value)}>
                {areas.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <Input label="Website URL" value={websiteUrl} onChange={(event) => setWebsiteUrl(event.target.value)} placeholder="https://..." />
            <Input label="Phone number" value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} placeholder="+44..." />
            <Input label="Email address" value={emailAddress} onChange={(event) => setEmailAddress(event.target.value)} placeholder="hello@business.co.uk" />
            <div className="md:col-span-2">
              <Input label="Address" value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Street, area, postcode" />
            </div>
            <Input label="Google rating" type="number" min="0" max="5" step="0.1" value={googleRating} onChange={(event) => setGoogleRating(event.target.value)} placeholder="4.6" />
            <Input label="Number of Google reviews" type="number" min="0" value={reviewCount} onChange={(event) => setReviewCount(event.target.value)} placeholder="78" />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className="section-kicker">Account status</span>
              <select className={fieldClassName()} value={accountStatus} onChange={(event) => setAccountStatus(event.target.value)}>
                {statuses.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-2">
              <span className="section-kicker">Priority</span>
              <select className={fieldClassName()} value={priority} onChange={(event) => setPriority(event.target.value)}>
                {priorities.map((option) => <option key={`${option.label}-${option.value}`} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <Input label="Due date" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
            <Input label="Estimated deal value £" type="number" min="0" value={dealValue} onChange={(event) => setDealValue(event.target.value)} placeholder="2400" />
            <Input label="Site score /100" type="number" min="0" max="100" value={siteScore} onChange={(event) => setSiteScore(event.target.value)} placeholder="42" />
          </div>

          <label className="flex flex-col gap-2">
            <span className="section-kicker">Next action notes</span>
            <textarea
              rows={4}
              className={`${fieldClassName()} py-3`}
              value={nextActionNotes}
              onChange={(event) => setNextActionNotes(event.target.value)}
              placeholder="What should happen next?"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="section-kicker">Source notes</span>
            <textarea
              rows={5}
              className={`${fieldClassName()} py-3`}
              value={sourceNotes}
              onChange={(event) => setSourceNotes(event.target.value)}
              placeholder="Where the lead came from, what was found, and why it matters."
            />
          </label>
        </section>

        <aside className="space-y-4">
          <div className="rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-5">
            <p className="section-kicker">What happens on save</p>
            <div className="mt-4 space-y-3 text-sm text-[var(--color-text-muted)]">
              <p>A permanent `EA-YYYY-NNNNNN` client ID is generated automatically.</p>
              <p>The record is written to SQLite through the existing CRM API.</p>
              <p>The account is immediately available in the React lead and CRM workspaces.</p>
              <p>A timeline event for `Account created` is logged automatically.</p>
            </div>
          </div>

          <div className="rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-5">
            <p className="section-kicker">Operator standard</p>
            <div className="mt-4 space-y-2 text-sm text-[var(--color-text-muted)]">
              <p>Start with a believable next action, not a blank record.</p>
              <p>Use source notes to preserve why this account deserves attention.</p>
              <p>Capture a phone or email if you have one so the outreach system can move immediately.</p>
            </div>
          </div>

          {error ? (
            <div className="rounded-[var(--radius-xl)] bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <Button variant="secondary" onClick={handleClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button className="min-w-[180px]" onClick={handleSubmit} disabled={!canSubmit || isSubmitting}>
              {isSubmitting ? "Creating account..." : "Create account"}
            </Button>
          </div>
        </aside>
      </div>
    </Modal>
  );
}
