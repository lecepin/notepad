import React from "react";
import { Menu, Icon, Button, Layout, Tooltip, message, Modal } from "antd";
import Editor from "for-editor";
import IndexDBWrapper from "indexdbwrapper";
import * as utils from "./utils";
import "./App.less";
const { Header, Sider, Content } = Layout;
const version = 2;
const tableNotepad = "notepad";

class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      editorContent: "",
      dbNotepads: [],
      notepadIndex: 0,
      menuKey: ["0"],
      editorPreview: false,
      editKey: 0, // 用于强制更新
    };
  }

  componentDidMount() {
    window.addEventListener("beforeunload", (e) => {
      const { dbNotepads, notepadIndex, editorContent } = this.state;
      var confirmationMessage = "o/";
      if (
        dbNotepads[notepadIndex] &&
        editorContent != dbNotepads[notepadIndex].value.content
      ) {
        this.confirmSaveData({
          id: dbNotepads[notepadIndex].primaryKey,
          content: editorContent,
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

        const objStore2 = db.createObjectStore("img", {
          autoIncrement: true,
          keyPath: "id",
        });
        objStore2.createIndex("name", "name", { unique: true });
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
    });

    document.addEventListener("paste", this.pasteToUpload.bind(this));
    document.addEventListener("drop", this.dropToUpload.bind(this));
    document.ondragover = (e) => {
      e.preventDefault();
    };

    this.getAllData();
  }

  pasteToUpload({ clipboardData: { items } }) {
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        this.uploadImg(items[i].getAsFile());
        break;
      }
    }
  }

  dropToUpload(e) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];

    if (file && file.type.indexOf("image/") > -1) {
      this.uploadImg(file);
    }
  }

  uploadImg(file) {
    const domArea = document.querySelector(".for-editor-content textarea");
    const data = new FormData();
    data.append("img", file);

    if (this.state.editorPreview || !domArea) {
      return;
    }

    return fetch("./update-img", {
      method: "post",
      body: data,
    })
      .then((data) => data.json())
      .then((data) => {
        const value = utils.insertTextValue(domArea, `![](${data.name})`);
        this.setState({
          editorContent: value,
        });
      });
  }

  handleEditorOnChange(value) {
    this.setState({
      editorContent: value,
    });
  }

  async handleAddBtnOnClick() {
    const { notepadIndex, dbNotepads, editorContent } = this.state;
    if (
      dbNotepads[notepadIndex] &&
      editorContent != dbNotepads[notepadIndex].value.content
    ) {
      this.confirmSaveData(
        {
          id: dbNotepads[notepadIndex].primaryKey,
          content: editorContent,
          modifyTime: Date.now(),
        },
        async () => {
          if (this.db) {
            const time = Date.now();
            await this.db.add(tableNotepad, {
              addTime: time,
              modifyTime: time,
              content: "",
              editorPreview: true,
              editKey: Date.now(),
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
        editorPreview: true,
        editKey: Date.now(),
      });
      this.getAllData();
    }
  }

  handleLeftMenuOnClick(value) {
    const { notepadIndex, dbNotepads, editorContent } = this.state;

    if (editorContent != dbNotepads[notepadIndex].value.content) {
      this.confirmSaveData(
        {
          id: dbNotepads[notepadIndex].primaryKey,
          content: editorContent,
          modifyTime: Date.now(),
        },
        () =>
          this.setState({
            notepadIndex: +value.key,
            menuKey: [value.key],
            editorContent: dbNotepads[+value.key].value.content,
            editorPreview: !!dbNotepads[+value.key].value.content,
            editKey: Date.now(),
          })
      );
      return;
    }

    this.setState({
      notepadIndex: +value.key,
      menuKey: [value.key],
      editorContent: dbNotepads[+value.key].value.content,
      editorPreview: !!dbNotepads[+value.key].value.content,
      editKey: Date.now(),
    });
  }

  async handleEditorSaveOnChange(value) {
    const { notepadIndex, dbNotepads } = this.state;

    if (!this.db) {
      return;
    }

    await this.db.put(tableNotepad, {
      id: dbNotepads[notepadIndex].primaryKey,
      content: utils.utf8_to_b64(value),
      modifyTime: Date.now(),
    });
    message.success("保存成功！", 1);
    this.getAllData({ updatePreview: false });
  }

  handleBtnDelOnClick() {
    const { notepadIndex, dbNotepads } = this.state;
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

  async getAllData({ updatePreview = true } = {}) {
    let dbNotepads = await this.db.getAllMatching(tableNotepad, {
      index: "modifyTime",
      includeKeys: !0,
      direction: "prev",
    });

    dbNotepads = dbNotepads.map((item) => ({
      ...item,
      value: { ...item.value, content: utils.b64_to_utf8(item.value.content) },
    }));

    const result = {
      dbNotepads,
      menuKey: ["0"],
      editorContent: dbNotepads[0] ? dbNotepads[0].value.content : "",
      notepadIndex: 0,
    };
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

  render() {
    const {
      editorContent,
      dbNotepads,
      notepadIndex,
      menuKey,
      editorPreview,
      editKey,
    } = this.state;

    return (
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
            {dbNotepads.length > 0 && (
              <Editor
                height="calc(100vh - 60px)"
                className="app-editor"
                value={editorContent}
                preview={editorPreview}
                toolbar={{
                  h1: true,
                  h2: true,
                  h3: true,
                  h4: true,
                  img: true,
                  link: true,
                  code: true,
                  preview: true,
                  expand: true,
                  save: true,
                  subfield: true,
                }}
                key={editKey}
                onChange={(value) => this.handleEditorOnChange(value)}
                onSave={(e) => this.handleEditorSaveOnChange(e)}
                addImg={(file) => this.uploadImg(file)}
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
    );
  }
}

export default App;
