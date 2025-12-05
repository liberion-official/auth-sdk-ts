import { useEffect } from "react";
import { useParams } from "react-router";
import { Layout } from "@/common/layout/layout";
import { useAuthContext } from "@/common/context";
import { decodeUrlParam } from "@/common/utils";
import Screens from "@/common/screens";

export default function StandaloneAuthPage() {
  const { url } = useParams();

  const { setBackendUrl } = useAuthContext();

  useEffect(() => {
    const decodedUrl = decodeUrlParam(url);
    setBackendUrl(decodedUrl);
  }, [url, setBackendUrl]);

  return (
    <Layout>
      <Screens />
    </Layout>
  );
}
