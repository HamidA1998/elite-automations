declare module "lucide-react/dist/esm/icons/*.js" {
  import type { ForwardRefExoticComponent, RefAttributes, SVGProps } from "react";

  type LucideIconProps = Omit<SVGProps<SVGSVGElement>, "ref"> & {
    size?: string | number;
    absoluteStrokeWidth?: boolean;
  } & RefAttributes<SVGSVGElement>;

  const Icon: ForwardRefExoticComponent<LucideIconProps>;
  export default Icon;
}
