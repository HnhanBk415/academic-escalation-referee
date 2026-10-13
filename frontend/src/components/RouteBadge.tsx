import { Badge } from "./ui/Badge";

export function RouteBadge({ value }: { value: string }) {
  return <Badge route={value}>{value.replaceAll("_", " ")}</Badge>;
}
