import Plugin from "../models/Plugin";
import { isElectron } from "react-device-detect";
import SparkMD5 from "spark-md5";
import {
  CommonTool,
  ConfigService,
} from "../assets/lib/kookit-extra-browser.min";
declare var window: any;
export const calculateFileMD5 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      const arrayBuffer = event.target?.result as ArrayBuffer;
      const md5Hash = SparkMD5.ArrayBuffer.hash(arrayBuffer);
      resolve(md5Hash);
    };

    reader.onerror = (error) => {
      reject(error);
    };

    reader.readAsArrayBuffer(file);
  });
};
export const fetchFileFromPath = (filePath: string) => {
  return new Promise<File>((resolve, reject) => {
    const fs = window.require("fs");

    fs.readFile(filePath, (err, data) => {
      if (err) {
        console.log(err);
        return;
      }
      const file = new File(
        [data],
        window.navigator.platform.indexOf("Win") > -1
          ? filePath.split("\\").reverse()[0]
          : filePath.split("/").reverse()[0],
        {
          lastModified: new Date().getTime(),
        }
      );
      resolve(file);
    });
  });
};

export const sleep = (time: number) => {
  return new Promise((resolve) => setTimeout(resolve, time));
};

export const scrollContents = (chapterTitle: string, chapterHref: string) => {
  if (!chapterHref) return;

  let contentBody = document.getElementsByClassName("navigation-body")[0];
  if (!contentBody) return;
  let contentList = contentBody.getElementsByClassName("book-content-name");
  let targetContent = Array.from(contentList).filter((item, index) => {
    item.setAttribute("style", "");
    return item.textContent === chapterTitle;
  });
  if (targetContent.length > 0) {
    contentBody.scrollTo({
      left: 0,
      top: (targetContent[0] as any).offsetTop,
      behavior: "smooth",
    });
    targetContent[0].setAttribute("style", "color:red; font-weight: bold");
  }
};
export const handleFullScreen = () => {
  if (isElectron) {
    if (ConfigService.getReaderConfig("isOpenInMain") === "yes") {
      window
        .require("electron")
        .ipcRenderer.invoke("enter-tab-fullscreen", "ping");
    } else {
      window.require("electron").ipcRenderer.invoke("enter-fullscreen", "ping");
    }
  }
};
export const handleExitFullScreen = () => {
  if (isElectron) {
    if (ConfigService.getReaderConfig("isOpenInMain") === "yes") {
      window
        .require("electron")
        .ipcRenderer.invoke("exit-tab-fullscreen", "ping");
    } else {
      window.require("electron").ipcRenderer.invoke("exit-fullscreen", "ping");
    }
  }
};
export const getQueryParams = (url: string) => {
  const urlObj = new URL(url);
  const params = new URLSearchParams(urlObj.search);
  const queryParams = {};
  for (let pair of params.entries()) {
    queryParams[pair[0]] = pair[1];
  }
  return queryParams;
};
export const getStorageLocation = () => {
  if (isElectron) {
    return localStorage.getItem("storageLocation")
      ? localStorage.getItem("storageLocation")
      : window
          .require("electron")
          .ipcRenderer.sendSync("storage-location", "ping");
  } else {
    return localStorage.getItem("storageLocation");
  }
};
export const getAllVoices = (pluginList: Plugin[]) => {
  let voiceList: any[] = [];
  for (
    let index = 0;
    index < pluginList.filter((item) => item.type === "voice").length;
    index++
  ) {
    const plugin = pluginList.filter((item) => item.type === "voice")[index];
    voiceList.push(...(plugin.voiceList as any[]));
  }
  return voiceList;
};
export const checkPlugin = async (plugin: Plugin) => {
  if (
    (await CommonTool.generateSHA256Hash(plugin.script)) !== plugin.scriptSHA256
  ) {
    return false;
  } else {
    return true;
  }
};
export const reloadManager = () => {
  if (isElectron) {
    window.require("electron").ipcRenderer.invoke("reload-main", "ping");
  } else {
    window.location.reload();
  }
};
export const openExternalUrl = (url: string, isPlugin: boolean = false) => {
  isElectron
    ? ConfigService.getReaderConfig("isUseBuiltIn") === "yes" || isPlugin
      ? window.require("electron").ipcRenderer.invoke("open-url", { url })
      : window.require("electron").shell.openExternal(url)
    : window.open(url);
};
export const getPageWidth = (
  readerMode: string,
  scale: string,
  margin: number
) => {
  const findValidMultiple = (limit: number) => {
    let multiple = limit - (limit % 12);

    while (multiple >= 0) {
      if (((multiple - multiple / 12) / 2) % 2 === 0) {
        return multiple;
      }
      multiple -= 12;
    }

    return limit;
  };
  let pageOffset = "";
  let pageWidth = "";
  if (document.body.clientWidth < 570) {
    let width = findValidMultiple(document.body.clientWidth - 72);
    pageOffset = `calc(50vw - ${width / 2}px)`;
    pageWidth = `${width}px`;
  } else if (readerMode === "scroll") {
    let width = findValidMultiple(276 * parseFloat(scale) * 2);

    pageOffset = `calc(50vw - ${width / 2}px)`;
    pageWidth = `${width}px`;
  } else if (readerMode === "single") {
    let width = findValidMultiple(276 * parseFloat(scale) * 2 - 36);

    pageOffset = `calc(50vw - ${width / 2}px)`;
    pageWidth = `${width}px`;
  } else if (readerMode === "double") {
    let width = findValidMultiple(document.body.clientWidth - 2 * margin - 80);
    pageOffset = `calc(50vw - ${width / 2}px)`;
    pageWidth = `${width}px`;
  }
  return {
    pageOffset,
    pageWidth,
  };
};
export const loadFontData = async () => {
  try {
    const availableFonts = await window.queryLocalFonts();
    return availableFonts.map((font: any) => {
      return {
        label: font.fullName,
        value: font.postscriptName,
      };
    });
  } catch (err) {
    console.error(err);
  }
};
export function removeSearchParams() {
  const url = new URL(window.location.href.split("?")[0]);
  window.history.replaceState({}, document.title, url.toString());
}
export function addChatBox() {
  const scriptContent = `
    (function (d, t) {
      var BASE_URL = "https://app.chatwoot.com";
      var g = d.createElement(t),
        s = d.getElementsByTagName(t)[0];
      g.src = BASE_URL + "/packs/js/sdk.js";
      g.defer = true;
      g.async = true;
      s.parentNode.insertBefore(g, s);
      g.onload = function () {
        window.chatwootSDK.run({
          websiteToken: "svaD5wxfU5UY1r5ZzpMtLqv2",
          baseUrl: BASE_URL,
        });
      };
    })(document, "script");
  `;

  const scriptElement = document.createElement("script");
  scriptElement.type = "text/javascript";
  scriptElement.text = scriptContent;
  document.head.appendChild(scriptElement);
}
export function removeChatBox() {
  const scriptElement = document.querySelector("script[src*='chatwoot']");
  if (scriptElement) {
    scriptElement.remove();
  }
}
