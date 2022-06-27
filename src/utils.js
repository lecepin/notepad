export function formatDate(date, fmt) {
  if (!date) {
    return "";
  }
  if (typeof date === "number") {
    date = new Date(date);
  }
  var o = {
    "M+": date.getMonth() + 1,
    "d+": date.getDate(),
    "h+": date.getHours(),
    "m+": date.getMinutes(),
    "s+": date.getSeconds(),
    "q+": Math.floor((date.getMonth() + 3) / 3),
    S: date.getMilliseconds(),
  };
  if (/(y+)/.test(fmt)) {
    fmt = fmt.replace(
      RegExp.$1,
      (date.getFullYear() + "").substr(4 - RegExp.$1.length)
    );
  }
  for (var k in o) {
    if (new RegExp("(" + k + ")").test(fmt)) {
      fmt = fmt.replace(
        RegExp.$1,
        RegExp.$1.length === 1 ? o[k] : ("00" + o[k]).substr(("" + o[k]).length)
      );
    }
  }
  return fmt;
}

export function utf8_to_b64(str) {
  return window.btoa(window.unescape(window.encodeURIComponent(str)));
}

export function b64_to_utf8(str) {
  return window.decodeURIComponent(window.escape(window.atob(str)));
}

export function insertTextValue($vm, text) {
  let value = $vm.value;
  if ($vm.selectionStart || $vm.selectionStart === 0) {
    const start = $vm.selectionStart;
    const end = $vm.selectionEnd;

    if (start === end) {
      value =
        value.substring(0, start) + text + value.substring(end, value.length);
    } else {
      value =
        value.substring(0, start) + text + value.substring(end, value.length);
    }
  }
  return value;
}
