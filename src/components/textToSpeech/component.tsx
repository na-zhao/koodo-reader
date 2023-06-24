import React from "react";
import { TextToSpeechProps, TextToSpeechState } from "./interface";
import { Trans } from "react-i18next";
import { speedList } from "../../constants/dropdownList";
import StorageUtil from "../../utils/serviceUtils/storageUtil";
import { sleep } from "../../utils/commonUtil";
import EdgeUtil from "../../utils/serviceUtils/edgeUtil";
import { isElectron } from "react-device-detect";
import toast from "react-hot-toast";
import RecordLocation from "../../utils/readUtils/recordLocation";

class TextToSpeech extends React.Component<
  TextToSpeechProps,
  TextToSpeechState
> {
  nodeList: string[];
  voices: any;
  edgeVoices: any;
  nativeVoices: any;
  constructor(props: TextToSpeechProps) {
    super(props);
    this.state = {
      isSupported: false,
      isAudioOn: false,
    };
    this.nodeList = [];
    this.voices = [];
    this.edgeVoices = [];
    this.nativeVoices = [];
  }
  async componentDidMount() {
    if ("speechSynthesis" in window) {
      this.setState({ isSupported: true });
    }
    if (this.state.isAudioOn) {
      window.speechSynthesis && window.speechSynthesis.cancel();
      this.setState({ isAudioOn: false });
    }
    let synth = window.speechSynthesis;
    synth.getVoices();
    if (isElectron) {
      this.edgeVoices = await EdgeUtil.getVoiceList();
    }
  }
  handleChangeAudio = () => {
    if (this.state.isAudioOn) {
      window.speechSynthesis.cancel();
      EdgeUtil.pauseAudio();
      this.setState({ isAudioOn: false });
    } else {
      this.handleStartSpeech();
    }
  };
  handleStartSpeech = () => {
    const setSpeech = () => {
      return new Promise((resolve, reject) => {
        let synth = window.speechSynthesis;
        let id;

        id = setInterval(() => {
          if (synth.getVoices().length !== 0) {
            resolve(synth.getVoices());
            clearInterval(id);
          } else {
            this.setState({ isSupported: false });
          }
        }, 10);
      });
    };

    let s = setSpeech();
    s.then(async (voices: any) => {
      this.nativeVoices = voices;
      this.voices = [
        ...voices,
        ...this.edgeVoices.map((item) => {
          return {
            name:
              item.FriendlyName.split("-")[1].trim() +
              " " +
              item.Gender +
              " " +
              item.FriendlyName.split(" ")[1],
          };
        }),
      ];
      this.setState({ isAudioOn: true }, () => {
        this.handleAudio();
        this.handleSelect();
      });
    });
  };
  handleSelect = () => {
    if (
      document.querySelector("#text-speech-speed") &&
      document.querySelector("#text-speech-voice") &&
      document.querySelector("#text-speech-speed")!.children[0] &&
      document.querySelector("#text-speech-voice")!.children[0]
    ) {
      document
        .querySelector("#text-speech-speed")!
        .children[
          speedList.option.indexOf(
            StorageUtil.getReaderConfig("voiceSpeed") || "1"
          )
        ]?.setAttribute("selected", "selected");
      document
        .querySelector("#text-speech-voice")!
        .children[StorageUtil.getReaderConfig("voiceIndex") || 0]?.setAttribute(
          "selected",
          "selected"
        );
    }
  };
  handleAudio = async () => {
    if (StorageUtil.getReaderConfig("isSliding") === "yes") {
      await sleep(1000);
    }
    this.nodeList = this.props.htmlBook.rendition
      .visibleText()
      .filter((item: string) => item && item.trim());
    await this.handleRead();
  };
  async handleRead() {
    let voiceIndex = StorageUtil.getReaderConfig("voiceIndex") || 0;
    let speed = StorageUtil.getReaderConfig("voiceSpeed") || 1;
    if (voiceIndex > this.nativeVoices.length) {
      EdgeUtil.setAudioPaths();
      await EdgeUtil.cacheAudio(
        [this.nodeList[0]],
        this.edgeVoices[voiceIndex - this.nativeVoices.length].ShortName,
        speed * 100 - 100
      );
    }
    setTimeout(async () => {
      if (voiceIndex > this.nativeVoices.length) {
        await EdgeUtil.cacheAudio(
          this.nodeList.slice(1),
          this.edgeVoices[voiceIndex - this.nativeVoices.length].ShortName,
          speed * 100 - 100
        );
      }
    }, 1);

    for (let index = 0; index < this.nodeList.length; index++) {
      let currentText = this.nodeList[index];
      let style = "background: #f3a6a68c";
      this.props.htmlBook.rendition.highlightNode(currentText, style);
      if (
        index >= EdgeUtil.getAudioPaths().length - 1 &&
        voiceIndex > this.nativeVoices.length
      ) {
        while (true) {
          if (index < EdgeUtil.getAudioPaths().length - 1) break;
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

      let res = await this.handleSpeech(
        index,
        StorageUtil.getReaderConfig("voiceIndex") || 0,
        StorageUtil.getReaderConfig("voiceSpeed") || 1
      );
      if (res === "end") {
        break;
      }
    }
    if (this.state.isAudioOn && this.props.isReading) {
      await window.require("electron").ipcRenderer.invoke("clear-tts");
      await this.props.htmlBook.rendition.next();
      let position = this.props.htmlBook.rendition.getPosition();
      RecordLocation.recordHtmlLocation(
        this.props.currentBook.key,
        position.text,
        position.chapterTitle,
        position.chapterDocIndex,
        position.chapterHref,
        position.count,
        position.percentage,
        position.cfi,
        position.page
      );
      this.nodeList = [];
      await this.handleAudio();
    }
  }
  handleSpeech = async (index: number, voiceIndex: number, speed: number) => {
    return new Promise<string>(async (resolve, reject) => {
      if (voiceIndex > this.nativeVoices.length) {
        let res = await EdgeUtil.readAloud(index);
        if (res === "loaderror") {
          resolve("start");
        } else {
          let player = EdgeUtil.getPlayer();
          player.on("end", async () => {
            if (!(this.state.isAudioOn && this.props.isReading)) {
              resolve("end");
            }
            resolve("start");
          });
        }
      } else {
        var msg = new SpeechSynthesisUtterance();
        msg.text = this.nodeList[index]
          .replace(/\s\s/g, "")
          .replace(/\r/g, "")
          .replace(/\n/g, "")
          .replace(/\t/g, "")
          .replace(/\f/g, "");

        msg.voice = window.speechSynthesis.getVoices()[voiceIndex];
        msg.rate = speed;
        window.speechSynthesis.speak(msg);
        msg.onerror = (err) => {
          console.log(err);
          resolve("start");
        };

        msg.onend = async (event) => {
          if (!(this.state.isAudioOn && this.props.isReading)) {
            resolve("end");
          }
          resolve("start");
        };
      }
    });
  };

  render() {
    return (
      <>
        {this.state.isSupported ? (
          <>
            <div className="single-control-switch-container">
              <span className="single-control-switch-title">
                <Trans>Turn on text-to-speech</Trans>
              </span>

              <span
                className="single-control-switch"
                onClick={() => {
                  this.handleChangeAudio();
                }}
                style={this.state.isAudioOn ? {} : { opacity: 0.6 }}
              >
                <span
                  className="single-control-button"
                  style={
                    this.state.isAudioOn
                      ? {
                          transform: "translateX(20px)",
                          transition: "transform 0.5s ease",
                        }
                      : {
                          transform: "translateX(0px)",
                          transition: "transform 0.5s ease",
                        }
                  }
                ></span>
              </span>
            </div>
            {this.state.isAudioOn && this.voices.length > 0 && (
              <div
                className="setting-dialog-new-title"
                style={{
                  marginLeft: "20px",
                  width: "88%",
                  marginTop: "20px",
                  fontWeight: 500,
                }}
              >
                <Trans>Voice</Trans>
                <select
                  name=""
                  className="lang-setting-dropdown"
                  id="text-speech-voice"
                  onChange={(event) => {
                    StorageUtil.setReaderConfig(
                      "voiceIndex",
                      event.target.value
                    );
                    toast(this.props.t("Take effect in a while"));
                  }}
                >
                  {this.voices.map((item, index) => {
                    return (
                      <option
                        value={index}
                        key={item.name}
                        className="lang-setting-option"
                      >
                        {item.name}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}
            {this.state.isAudioOn && (
              <div
                className="setting-dialog-new-title"
                style={{ marginLeft: "20px", width: "88%", fontWeight: 500 }}
              >
                <Trans>Speed</Trans>
                <select
                  name=""
                  id="text-speech-speed"
                  className="lang-setting-dropdown"
                  onChange={(event) => {
                    StorageUtil.setReaderConfig(
                      "voiceSpeed",
                      event.target.value
                    );
                    toast(this.props.t("Take effect in a while"));
                  }}
                >
                  {speedList.option.map((item) => (
                    <option value={item} className="lang-setting-option">
                      {item}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </>
        ) : null}
      </>
    );
  }
}

export default TextToSpeech;
