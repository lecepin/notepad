import React from "react";
import { Menu, Icon, Button, Layout, Tooltip, message, Modal } from "antd";
import { Editor } from "@toast-ui/react-editor";
import chart from "@toast-ui/editor-plugin-chart";
import codeSyntaxHighlight from "@toast-ui/editor-plugin-code-syntax-highlight";
import colorSyntax from "@toast-ui/editor-plugin-color-syntax";
import tableMergedCell from "@toast-ui/editor-plugin-table-merged-cell";
import uml from "@toast-ui/editor-plugin-uml";

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
      dbNotepads: [],
      notepadIndex: 0,
      menuKey: ["0"],
      editorPreview: false,
      editKey: 0, // 用于强制更新
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

      if ((e.ctrlKey || e.metaKey) && e.keyCode == 83) {
        // ctrl + s 保存
        e.preventDefault();
        this.handleEditorSaveOnChange();
      }
    });

    this.getAllData();
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
          id: dbNotepads[notepadIndex].primaryKey,
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
      id: dbNotepads[notepadIndex].primaryKey,
      content: utils.utf8_to_b64(this.editorContent),
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

  render() {
    const { dbNotepads, notepadIndex, menuKey, editKey } = this.state;

    const editorContent = this.editorContent;

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
                key={editKey}
                ref={(_) => (this.ref = _)}
                language="zh-Hans"
                initialValue={editorContent}
                height="calc(100vh - 60px)"
                initialEditType="wysiwyg"
                useCommandShortcut={false}
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
    );
  }
}

export default App;
