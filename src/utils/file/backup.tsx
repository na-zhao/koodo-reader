import BookUtil from "./bookUtil";
import { isElectron } from "react-device-detect";
import PluginService from "../service/pluginService";
import BookService from "../service/bookService";
import NoteService from "../service/noteService";
import BookmarkService from "../service/bookmarkService";
import WordService from "../service/wordService";
import { getStorageLocation } from "../common";
import CoverUtil from "./coverUtil";
import ConfigService from "../service/configService";
import { getCloudConfig } from "./common";
declare var window: any;
export const backup = async (service: string): Promise<Boolean> => {
  let fileName = "data.zip";
  if (service === "local") {
    let year = new Date().getFullYear(),
      month = new Date().getMonth() + 1,
      day = new Date().getDate();
    fileName = `${year}-${month <= 9 ? "0" + month : month}-${
      day <= 9 ? "0" + day : day
    }.zip`;
  }
  if (isElectron) {
    const { ipcRenderer } = window.require("electron");
    let targetPath = "";
    if (service === "local") {
      const backupPath = await ipcRenderer.invoke("select-path");
      if (!backupPath) {
        return false;
      }
      targetPath = backupPath;
    } else {
      const path = window.require("path");
      let dataPath = await ipcRenderer.sendSync("user-data", "ping");
      targetPath = path.join(dataPath, "backup");
    }
    await backupFromPath(targetPath, fileName);
    if (service === "local") {
      return true;
    } else {
      let tokenConfig = getCloudConfig(service);

      return await ipcRenderer.invoke("cloud-upload", {
        ...tokenConfig,
        fileName: "data.zip",
        service: service,
      });
    }
  } else {
    let blob: Blob | boolean = await backupFromStorage();
    if (!blob) {
      return false;
    }
    if (service === "local") {
      window.saveAs(blob as Blob, fileName);
      return true;
    } else {
      const { SyncUtil } = await import(
        "../../assets/lib/kookit-sync-browser.min.js"
      );
      let tokenConfig = getCloudConfig(service);

      let syncUtil = new SyncUtil(service, tokenConfig);
      let result = await syncUtil.uploadFile(fileName, "backup", blob as Blob);
      if (result) {
        return true;
      } else {
        return false;
      }
    }
  }
};

export const backupFromPath = async (targetPath: string, fileName: string) => {
  const path = window.require("path");
  const AdmZip = window.require("adm-zip");
  const dataPath = getStorageLocation() || "";
  let zip = new AdmZip();
  const fs = window.require("fs");
  if (!fs.existsSync(path.join(targetPath))) {
    fs.mkdirSync(path.join(targetPath));
  }
  backupToConfigJson();
  if (fs.existsSync(path.join(dataPath, "book"))) {
    zip.addLocalFolder(path.join(dataPath, "book"), "book");
  }
  if (fs.existsSync(path.join(dataPath, "cover"))) {
    zip.addLocalFolder(path.join(dataPath, "cover"), "cover");
  }
  if (fs.existsSync(path.join(dataPath, "config", "config.json"))) {
    zip.addLocalFile(path.join(dataPath, "config", "config.json"), "config");
  }
  if (fs.existsSync(path.join(dataPath, "config", "notes.db"))) {
    zip.addLocalFile(path.join(dataPath, "config", "notes.db"), "config");
  }
  if (fs.existsSync(path.join(dataPath, "config", "books.db"))) {
    zip.addLocalFile(path.join(dataPath, "config", "books.db"), "config");
  }
  if (fs.existsSync(path.join(dataPath, "config", "bookmarks.db"))) {
    zip.addLocalFile(path.join(dataPath, "config", "bookmarks.db"), "config");
  }
  if (fs.existsSync(path.join(dataPath, "config", "words.db"))) {
    zip.addLocalFile(path.join(dataPath, "config", "words.db"), "config");
  }
  if (fs.existsSync(path.join(dataPath, "config", "plugins.db"))) {
    zip.addLocalFile(path.join(dataPath, "config", "plugins.db"), "config");
  }
  await zip.writeZip(path.join(targetPath, fileName));

  // return new Blob([zip.toBuffer()], { type: "application/zip" });
};
export const backupFromStorage = async () => {
  let zip = new window.JSZip();
  let books = await BookService.getDbBuffer();
  let notes = await NoteService.getDbBuffer();
  let bookmarks = await BookmarkService.getDbBuffer();
  let words = await WordService.getDbBuffer();
  let plugins = await PluginService.getDbBuffer();
  let config = JSON.stringify(ConfigService.getConfigJson());
  console.log(books, notes, bookmarks, words, plugins, config);
  await zipCover(zip);
  await zipBook(zip);
  let result = await zipConfig(
    zip,
    books,
    notes,
    bookmarks,
    words,
    plugins,
    config
  );
  if (!result) return false;
  return await zip.generateAsync({ type: "blob" });
};

export const backupToConfigJson = () => {
  let configStr = JSON.stringify(ConfigService.getConfigJson());
  const fs = window.require("fs");
  const path = window.require("path");
  const dataPath = getStorageLocation() || "";
  if (!fs.existsSync(path.join(dataPath))) {
    fs.mkdirSync(path.join(dataPath), { recursive: true });
  }
  fs.writeFileSync(
    path.join(dataPath, "config", "config.json"),
    configStr,
    "utf-8"
  );
};
export const zipBook = (zip: any) => {
  return new Promise<boolean>(async (resolve, reject) => {
    let books = await BookService.getAllBooks();
    let bookZip = zip.folder("book");
    let data: any = [];
    books &&
      books.forEach((item) => {
        data.push(
          BookUtil.fetchBook(
            item.key,
            item.format.toLowerCase(),
            false,
            item.path
          )
        );
      });
    try {
      let results = await Promise.all(data);
      for (let i = 0; i < books.length; i++) {
        results[i] &&
          bookZip.file(
            `${books[i].key}.${books[i].format.toLocaleLowerCase()}`,
            results[i]
          );
      }
      resolve(true);
    } catch (error) {
      resolve(false);
    }
  });
};
export const zipCover = async (zip: any) => {
  let books = await BookService.getAllBooks();
  let coverZip = zip.folder("cover");
  if (isElectron) {
  } else {
    for (let i = 0; i < books.length; i++) {
      const result = CoverUtil.convertCoverBase64(CoverUtil.getCover(books[i]));
      coverZip.file(`${books[i].key}.${result.extension}`, result.arrayBuffer);
    }
  }
};

export const zipConfig = (
  zip: any,
  bookBuffer: ArrayBuffer,
  noteBuffer: ArrayBuffer,
  bookmarkBuffer: ArrayBuffer,
  wordBuffer: ArrayBuffer,
  pluginBuffer: ArrayBuffer,
  config: string
) => {
  return new Promise<boolean>((resolve, reject) => {
    try {
      let configZip = zip.folder("config");
      configZip
        .file("notes.db", noteBuffer)
        .file("books.db", bookBuffer)
        .file("bookmarks.db", bookmarkBuffer)
        .file("words.db", wordBuffer)
        .file("plugins.db", pluginBuffer)
        .file("config.json", config);
      resolve(true);
    } catch (error) {
      resolve(false);
    }
  });
};
