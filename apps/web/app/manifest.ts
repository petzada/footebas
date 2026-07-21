import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return { name: "Footebas", short_name: "Footebas", description: "Sua carreira, sua história.", start_url: "/", display: "standalone", background_color: "#10251b", theme_color: "#62c873", orientation: "portrait" };
}
