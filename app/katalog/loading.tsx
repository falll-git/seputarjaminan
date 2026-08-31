import PublicLoadingState from "../components/PublicLoadingState";
import SiteFooter from "../components/SiteFooter";
import SiteHeader from "../components/SiteHeader";

export default function CatalogLoading() {
  return (
    <>
      <SiteHeader />
      <PublicLoadingState variant="catalog" />
      <SiteFooter />
    </>
  );
}
