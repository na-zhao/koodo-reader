import axios from "axios";
import toast from "react-hot-toast";
import i18n from "../../i18n";
import { useHistory } from "react-router-dom";
import { TokenService } from "../../assets/lib/kookit-extra-browser.min";
const PUBLIC_URL = "https://api.960960.xyz";
export const checkDeveloperUpdate = async () => {
  let res = await axios.get(PUBLIC_URL + "/api/update_dev");
  return res.data;
};
export const getUploadUrl = async () => {
  let res = await axios.get(PUBLIC_URL + "/api/get_temp_upload_url");
  return res.data;
};
export const uploadFile = async (url: string, file: any) => {
  return new Promise<boolean>((resolve, reject) => {
    axios
      .put(url, file, {})
      .then((res) => {
        resolve(true);
      })
      .catch((err) => {
        console.log(err);
        resolve(false);
      });
  });
};
export const checkStableUpdate = async () => {
  let res = await axios.get(
    PUBLIC_URL + `/api/update?name=${navigator.language}`
  );
  return res.data.log;
};
export const sendFeedback = async (data: any) => {
  let config: any = {
    method: "post",
    maxBodyLength: Infinity,
    url: PUBLIC_URL + "/api/feedback",
    headers: {
      "Content-Type": "application/json",
    },
    data: data,
  };

  let res = await axios.request(config);
  return res.data.result;
};
export const handleExitApp = async () => {
  toast.error(i18n.t("Authorization failed, please login again"));
  await TokenService.deleteToken("is_authed");
  await TokenService.deleteToken("access_token");
  await TokenService.deleteToken("refresh_token");
  await TokenService.deleteToken("user_type");
  await TokenService.deleteToken("user_valid_until");
  //路由到login页面
};
