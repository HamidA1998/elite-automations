import {brand} from "@/config";
import type {QualifiedLead} from "@/types";

export function createEmail(lead: QualifiedLead) {
  const subject = `${lead.businessName}: quick idea to improve your website`;
  const observation = lead.audit.topProblems[0] ?? "the site could make the offer clearer on first view";
  const benefit =
    lead.businessType.toLowerCase().includes("dent")
      ? "That usually means more confidence-led enquiries and better-quality bookings."
      : lead.businessType.toLowerCase().includes("restaurant")
        ? "That usually means more menu views, bookings, and takeaway intent from mobile visitors."
        : "That usually means more qualified local enquiries from visitors who decide faster.";

  const body = `Subject: ${subject}

Hi ${lead.businessName},

I had a quick look at your website and noticed ${observation.toLowerCase()}.

I’ve already built a completely free demo of how a stronger version could look, along with a 30-second preview video showing it.

For a ${lead.businessType.toLowerCase()} in ${lead.area}, a cleaner first impression and clearer CTA can help turn more visitors into real enquiries. ${benefit}

I’ve already built it — want me to send it over? No cost, no obligation.

${brand.ownerName}
${brand.businessName}
${brand.domain}
`;

  return {subject, body};
}
