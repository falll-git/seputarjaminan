import PublicLoadingState from "./components/PublicLoadingState";
import SiteFooter from "./components/SiteFooter";
import SiteHeader from "./components/SiteHeader";

export default function Loading() {
  return (
    <>
      <SiteHeader />
      <PublicLoadingState variant="home" />
      <SiteFooter />
    </>
  );
}
