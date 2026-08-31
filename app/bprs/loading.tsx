import PublicLoadingState from "../components/PublicLoadingState";
import SiteFooter from "../components/SiteFooter";
import SiteHeader from "../components/SiteHeader";

export default function BprsLoading() {
  return (
    <>
      <SiteHeader />
      <PublicLoadingState variant="directory" />
      <SiteFooter />
    </>
  );
}
