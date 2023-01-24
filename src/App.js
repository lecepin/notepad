import React from "react";
import {
  Menu,
  Icon,
  Button,
  Layout,
  Tooltip,
  message,
  Modal,
  Input,
  Form,
} from "antd";
import { Editor } from "@toast-ui/react-editor";
import chart from "@toast-ui/editor-plugin-chart";
import codeSyntaxHighlight from "@toast-ui/editor-plugin-code-syntax-highlight/dist/toastui-editor-plugin-code-syntax-highlight-all.js";
import colorSyntax from "@toast-ui/editor-plugin-color-syntax";
import tableMergedCell from "@toast-ui/editor-plugin-table-merged-cell";
import uml from "@toast-ui/editor-plugin-uml";
import { v4 } from "uuid";

import IndexDBWrapper from "indexdbwrapper";
import * as utils from "./utils";
import "./App.less";
const { Header, Sider, Content } = Layout;
const version = 4;
const tableNotepad = "notepad";

const HOST = "";

class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      dbNotepads: [],
      notepadIndex: 0,
      menuKey: ["0"],
      editorPreview: false,
      editKey: 0, // 用于强制更新
      needLogin: false,
      apiValid: false,
    };
    this.editorContent = "";
  }

  componentDidMount() {
    window.addEventListener("beforeunload", (e) => {
      const { dbNotepads, notepadIndex } = this.state;
      var confirmationMessage = "o/";
      if (
        dbNotepads[notepadIndex] &&
        this.editorContent != dbNotepads[notepadIndex].value.content
      ) {
        this.confirmSaveData({
          id: dbNotepads[notepadIndex].primaryKey,
          content: this.editorContent,
          modifyTime: Date.now(),
        });
        (e || window.event).returnValue = confirmationMessage;
        return confirmationMessage;
      } else {
        return null;
      }
    });

    this.db = new IndexDBWrapper("lp-notepad", version, {
      onupgradeneeded: (e) => {
        const db = e.target.result;
        const objStore = db.createObjectStore(tableNotepad, {
          autoIncrement: true,
          keyPath: "id",
        });
        objStore.createIndex("addTime", "addTime", { unique: !1 });
        objStore.createIndex("modifyTime", "modifyTime", { unique: !1 });
        objStore.createIndex("content", "content", { unique: !1 });
      },
    });

    window.addEventListener("keydown", async (e) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.shiftKey) {
        switch (e.keyCode) {
          case 79: {
            // ctrl + shift + O 导出
            e.preventDefault();
            console.log("导出数据");
            const dbData = await this.db.getAllMatching(tableNotepad, {
              index: "modifyTime",
              includeKeys: !0,
              direction: "prev",
            });
            if (!this.elDownload) {
              this.elDownload = window.document.createElement("a");
              this.elDownload.style.display = "none";
            }

            this.elDownload.setAttribute(
              "download",
              "备忘录备份_" + new Date()
            );
            this.elDownload.setAttribute(
              "href",
              URL.createObjectURL(
                new Blob([JSON.stringify(dbData, null, 2)], {
                  type: "text/plain",
                })
              )
            );
            this.elDownload.click();
            break;
          }
          case 73: {
            // ctrl + shift + I 导入
            e.preventDefault();
            break;
          }
          case 76: {
            // ctrl + shift + P 密码设置
            e.preventDefault();
            break;
          }
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.keyCode == 83) {
        // ctrl + s 保存
        e.preventDefault();
        this.handleEditorSaveOnChange();
      }
    });

    this.getAllData();

    fetch(HOST + "/api/valid")
      .then((res) => res.json())
      .then((res) => {
        if (res.success) {
          this.setState({
            apiValid: true,
          });
        }
      })
      .catch((err) => {
        console.log(err);
      });
  }

  handleEditorOnChange(value) {
    this.editorContent = this.ref.getInstance().getMarkdown();
  }

  async handleAddBtnOnClick() {
    const { notepadIndex, dbNotepads } = this.state;
    if (
      dbNotepads[notepadIndex] &&
      this.editorContent != dbNotepads[notepadIndex].value.content
    ) {
      this.confirmSaveData(
        {
          ...dbNotepads[notepadIndex].value,
          content: this.editorContent,
          modifyTime: Date.now(),
        },
        async () => {
          if (this.db) {
            const time = Date.now();
            await this.db.add(tableNotepad, {
              addTime: time,
              modifyTime: time,
              content: "",
              id: v4(),
            });
            this.getAllData();
          }
        }
      );
      return;
    }
    if (this.db) {
      const time = Date.now();
      await this.db.add(tableNotepad, {
        addTime: time,
        modifyTime: time,
        content: "",
        id: v4(),
      });
      this.getAllData();
    }
  }

  handleLeftMenuOnClick(value) {
    const { notepadIndex, dbNotepads } = this.state;

    if (this.editorContent != dbNotepads[notepadIndex].value.content) {
      this.confirmSaveData(
        {
          id: dbNotepads[notepadIndex].primaryKey,
          content: this.editorContent,
          modifyTime: Date.now(),
        },
        () => {
          this.editorContent = dbNotepads[+value.key].value.content;
          this.setState({
            notepadIndex: +value.key,
            menuKey: [value.key],

            editorPreview: !!dbNotepads[+value.key].value.content,
            editKey: Date.now(),
          });
        }
      );
      return;
    }

    this.editorContent = dbNotepads[+value.key].value.content;

    this.setState({
      notepadIndex: +value.key,
      menuKey: [value.key],
      editKey: Date.now(),
    });
  }

  async handleEditorSaveOnChange() {
    const { notepadIndex, dbNotepads } = this.state;

    if (!this.db || !this.editorContent) {
      return;
    }

    await this.db.put(tableNotepad, {
      ...dbNotepads[notepadIndex].value,
      content: utils.utf8_to_b64(this.editorContent),
      modifyTime: Date.now(),
    });
    message.success("保存成功！", 1);
    this.getAllData({ updatePreview: false });
  }

  handleBtnDelOnClick() {
    const { notepadIndex, dbNotepads } = this.state;
    console.log(notepadIndex, dbNotepads[notepadIndex]);
    Modal.confirm({
      title: "提示",
      content: "确定删除吗？删除后不可恢复",
      okText: "确定",
      okType: "danger",
      cancelText: "取消",
      onOk: async () => {
        await this.db.delete(tableNotepad, dbNotepads[notepadIndex].primaryKey);
        message.success("删除成功！", 1);
        this.getAllData();
      },
      onCancel() {},
    });
  }

  async getAllData({ updatePreview = true, isGetData } = {}) {
    let dbNotepads = await this.db.getAllMatching(tableNotepad, {
      index: "modifyTime",
      includeKeys: !0,
      direction: "prev",
    });

    if (isGetData) {
      return dbNotepads?.map((item) => item.value);
    }

    dbNotepads = dbNotepads.map((item) => ({
      ...item,
      value: { ...item.value, content: utils.b64_to_utf8(item.value.content) },
    }));

    const result = {
      dbNotepads,
      menuKey: ["0"],
      notepadIndex: 0,
    };
    this.editorContent = dbNotepads[0] ? dbNotepads[0].value.content : "";

    if (updatePreview) {
      result.editorPreview = dbNotepads[0] && dbNotepads[0].value.content;
      result.editKey = Date.now();
    }
    this.setState(result);
  }

  confirmSaveData(data, onCancel = (f) => f) {
    Modal.confirm({
      title: "提示",
      content: "内容变动，是否保存？",
      okText: "保存",
      cancelText: "放弃",
      onOk: async () => {
        await this.db.put(tableNotepad, {
          ...data,
          content: utils.utf8_to_b64(data.content),
        });
        message.success("保存成功！", 1);
        this.getAllData({ updatePreview: false });
      },
      onCancel,
    });
  }

  async pushToServer() {
    const { notepadIndex, dbNotepads } = this.state;

    if (this.editorContent != dbNotepads[notepadIndex].value.content) {
      return Modal.warn({
        title: "提示",
        content: "内容变动，请先进行保存",
        okText: "确定",
      });
    }

    Modal.confirm({
      title: "推送",
      content: "将会覆盖远端数据，是否进行？",
      okText: "推送",
      cancelText: "取消",
      onOk: async () => {
        const dbData = ((await this.getAllData({ isGetData: true })) || []).map(
          (item) => ({
            ...item,
            content: item.content.replace(/\+/g, "%2B"),
          })
        );

        const hide = message.loading("推送中…", 0);

        fetch(HOST + "/api/protected/push-to-server", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: "Bearer " + localStorage.getItem("jwttoken"),
          },
          body: `data=${JSON.stringify(dbData)}`,
        })
          .then((res) => {
            if (res.status === 401) {
              return Promise.reject("Unauthorized.");
            }

            return res.json();
          })
          .then(({ success }) => {
            if (success) {
              message.success("推送成功");
            } else {
              message.error("推送失败");
            }
          })
          .catch((err) => {
            if (err === "Unauthorized.") {
              this.login();
            }
          })
          .finally(() => {
            hide();
          });
      },
    });
  }

  pullToLocal() {
    Modal.confirm({
      title: "拉取",
      content: "将会覆盖本地数据，是否进行？",
      okText: "拉取",
      cancelText: "取消",
      onOk: async () => {
        const hide = message.loading("拉取中…", 0);

        fetch(HOST + "/api/protected/get-server-data", {
          headers: {
            Authorization: "Bearer " + localStorage.getItem("jwttoken"),
          },
        })
          .then((res) => {
            if (res.status === 401) {
              return Promise.reject("Unauthorized.");
            }

            return res.json();
          })
          .then(({ success, data }) => {
            if (success) {
              if (data?.length) {
                Promise.all(data.map((item) => this.db.put(tableNotepad, item)))
                  .then(() => {
                    message.success("拉取成功");
                    this.getAllData();
                  })
                  .catch(() => {
                    message.error("填充失败");
                  });
              } else {
                message.warn("远端无数据");
              }
            } else {
              message.error("拉取失败");
            }
          })
          .catch((err) => {
            if (err === "Unauthorized.") {
              this.login();
            }
          })
          .finally(() => {
            hide();
          });
      },
    });
  }

  login() {
    message.error("登录已过期，请重新登录！", 1);
    this.setState({ needLogin: true });
  }

  loginSubmit(e) {
    e.preventDefault();

    const username = document.querySelector(
      ".login-form input[name=username]"
    )?.value;
    const password = document.querySelector(
      ".login-form input[name=password]"
    )?.value;

    fetch(HOST + "/sessions/create", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `username=${username}&password=${password}`,
    })
      .then((res) => res.json())
      .then((res) => {
        localStorage.setItem("jwttoken", res.access_token);
        message.success("登录成功！", 1);
        this.setState({
          needLogin: false,
        });
      })
      .catch((err) => {
        console.log(err);
        message.error("登录失败！", 1);
      });
  }

  render() {
    const { dbNotepads, notepadIndex, menuKey, editKey, needLogin, apiValid } =
      this.state;

    const editorContent = this.editorContent;

    return (
      <>
        <Layout className="app">
          <Sider className="app-left-side">
            <Menu
              mode="inline"
              theme="dark"
              selectedKeys={menuKey}
              onClick={(e) => this.handleLeftMenuOnClick(e)}
            >
              {dbNotepads.map((item, index) => (
                <Menu.Item key={index}>
                  {item.value.content || "新建备忘录"}
                </Menu.Item>
              ))}
            </Menu>
          </Sider>
          <Layout>
            <Content>
              <div className="app-modify-time">
                {dbNotepads.length > 0
                  ? utils.formatDate(
                      dbNotepads[notepadIndex].value.modifyTime,
                      "yyyy-MM-dd, hh:mm:ss"
                    )
                  : ""}
              </div>
              {apiValid ? (
                <div className="app-sync">
                  <Tooltip placement="bottom" title="拉取远端数据">
                    <svg
                      onClick={() => {
                        this.pullToLocal();
                      }}
                      viewBox="0 0 1024 1024"
                      version="1.1"
                      xmlns="http://www.w3.org/2000/svg"
                      width="32"
                      height="32"
                    >
                      <path
                        d="M512 960C264.96 960 64 759.04 64 512S264.96 64 512 64s448 200.96 448 448-200.96 448-448 448z m0-832c-211.744 0-384 172.256-384 384s172.256 384 384 384 384-172.256 384-384-172.256-384-384-384z"
                        p-id="4949"
                        fill="#8a8a8a"
                      ></path>
                      <path
                        d="M694.56 522.144c-12.544-12.608-33.376-12.64-45.952-0.064L544 625.984V319.328c0-17.76-14.208-32.16-32-32.16-17.76 0-32 14.4-32 32.16v308.32L374.784 520.96c-12.48-12.608-32.704-12.736-45.312-0.256-12.64 12.512-12.672 32.896-0.192 45.504l159.36 161.056a32.187 32.187 0 0 0 22.88 9.568c8.16 0 16.384-3.168 22.624-9.312l0.064-0.128c0.032 0 0.064 0 0.096-0.064l160.192-159.68c12.576-12.544 12.608-32.928 0.064-45.504z"
                        p-id="4950"
                        fill="#8a8a8a"
                      ></path>
                    </svg>
                  </Tooltip>
                  <Tooltip placement="bottomRight" title="推送到远端">
                    <svg
                      onClick={() => {
                        this.pushToServer();
                      }}
                      viewBox="0 0 1024 1024"
                      version="1.1"
                      xmlns="http://www.w3.org/2000/svg"
                      width="32"
                      height="32"
                    >
                      <path
                        d="M512 960C264.96 960 64 759.04 64 512S264.96 64 512 64s448 200.96 448 448-200.96 448-448 448z m0-832c-211.744 0-384 172.256-384 384s172.256 384 384 384 384-172.256 384-384-172.256-384-384-384z"
                        p-id="4553"
                        fill="#8a8a8a"
                      ></path>
                      <path
                        d="M694.464 458.368L535.968 298.112c-9.344-9.472-23.168-11.84-34.784-7.136-0.736 0.288-1.312 0.992-2.016 1.344-2.976 1.472-5.952 3.072-8.448 5.536-0.032 0.032-0.032 0.064-0.064 0.096s-0.064 0.032-0.096 0.064L331.2 456.928c-12.512 12.48-12.544 32.736-0.064 45.248 6.24 6.272 14.464 9.408 22.656 9.408 8.16 0 16.352-3.104 22.592-9.344L480 398.944V704c0 17.696 14.336 32 32 32s32-14.304 32-32V397.248L648.96 503.36c6.24 6.336 14.496 9.504 22.752 9.504 8.128 0 16.256-3.072 22.496-9.248 12.576-12.416 12.704-32.672 0.256-45.248z"
                        p-id="4554"
                        fill="#8a8a8a"
                      ></path>
                    </svg>
                  </Tooltip>
                </div>
              ) : null}
              {dbNotepads.length > 0 && (
                <Editor
                  key={editKey}
                  ref={(_) => (this.ref = _)}
                  language="zh-Hans"
                  initialValue={editorContent}
                  height="calc(100vh - 60px)"
                  initialEditType="wysiwyg"
                  // useCommandShortcut={false}
                  plugins={[colorSyntax, chart, codeSyntaxHighlight, uml]}
                  onChange={this.handleEditorOnChange.bind(this)}
                />
              )}
              <div className="app-copyright">
                © 2019
                <Icon type="heart" className="love-icon" theme="filled" />
                <a href="https://github.com/lecepin" target="_blank">
                  Lecepin
                </a>
              </div>
              <Tooltip placement="left" title="添加">
                <Button
                  type="primary"
                  shape="circle"
                  icon="plus"
                  size="large"
                  className="app-btn-add"
                  onClick={() => this.handleAddBtnOnClick()}
                />
              </Tooltip>

              {dbNotepads.length > 0 && (
                <Tooltip placement="left" title="删除">
                  <Button
                    type="danger"
                    shape="circle"
                    icon="delete"
                    size="large"
                    className="app-btn-del"
                    onClick={() => this.handleBtnDelOnClick()}
                  />
                </Tooltip>
              )}
              {dbNotepads.length == 0 && (
                <div className="app-no-data">
                  点击右下角按钮，进行备忘录添加~~
                </div>
              )}
            </Content>
          </Layout>
        </Layout>
        {needLogin ? (
          <Modal
            title="登陆"
            visible
            onOk={() => {}}
            onCancel={() => {
              this.setState({
                needLogin: false,
              });
            }}
            footer={false}
          >
            <Form
              className="login-form"
              onSubmit={(e) => {
                this.loginSubmit(e);
              }}
            >
              <Form.Item>
                <Input
                  required
                  prefix={
                    <Icon type="user" style={{ color: "rgba(0,0,0,.25)" }} />
                  }
                  placeholder="用户名"
                  name="username"
                />
              </Form.Item>
              <Form.Item>
                <Input
                  required
                  prefix={
                    <Icon type="lock" style={{ color: "rgba(0,0,0,.25)" }} />
                  }
                  type="password"
                  placeholder="密码"
                  name="password"
                />
              </Form.Item>
              <Form.Item style={{ textAlign: "right", margin: 0 }}>
                <Button type="primary" htmlType="submit">
                  登陆
                </Button>
              </Form.Item>
            </Form>
          </Modal>
        ) : null}
      </>
    );
  }
}

export default App;
