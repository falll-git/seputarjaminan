import PublicLoadingState from "../../components/PublicLoadingState";
import SiteFooter from "../../components/SiteFooter";
import SiteHeader from "../../components/SiteHeader";

export default function AssetLoading() {
  return (
    <>
      <SiteHeader />
      <PublicLoadingState variant="detail" />
      <SiteFooter />
    </>
  );
}
