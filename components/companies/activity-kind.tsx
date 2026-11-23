import { Mail, Phone, StickyNote, Users, type LucideIcon } from "lucide-react";
import type { ActivityKind } from "@/lib/crm";

export const ACTIVITY_KIND_ICON: Record<ActivityKind, LucideIcon> = {
  Email: Mail,
  Call: Phone,
  Meeting: Users,
  Note: StickyNote,
};
