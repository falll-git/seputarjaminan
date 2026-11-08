import PublicLoadingState from "../../components/PublicLoadingState";
import SiteHeader from "../../components/SiteHeader";
import SiteFooter from "../../components/SiteFooter";

export default function ProfileLoading() {
  return <><SiteHeader/><PublicLoadingState variant="profile"/><SiteFooter compact/></>;
}
