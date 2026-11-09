(function () {
  if (window.__metroAssistBridge) return;
  window.__metroAssistBridge = true;

  var blobs = {};
  var createObjectURL = URL.createObjectURL;
  URL.createObjectURL = function (object) {
    var url = createObjectURL.call(URL, object);
    try {
      if (window.Blob && object instanceof Blob) blobs[url] = object;
    } catch (error) {
      /* ignore */
    }
    return url;
  };

  function save(name, mime, base64) {
    if (!window.MetroAndroid || !window.MetroAndroid.saveBase64) return false;
    window.MetroAndroid.saveBase64(name, mime || "application/octet-stream", base64);
    return true;
  }

  var click = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    try {
      var href = this.getAttribute("href") || "";
      var name = this.getAttribute("download") || "";
      if (name && (href.indexOf("blob:") === 0 || href.indexOf("data:") === 0)) {
        if (href.indexOf("data:") === 0) {
          var comma = href.indexOf(",");
          if (comma > 0) {
            var header = href.substring(5, comma);
            var mime = header.split(";")[0] || "application/octet-stream";
            if (save(name, mime, href.substring(comma + 1))) return;
          }
        }
        var blob = blobs[href];
        if (blob) {
          var reader = new FileReader();
          reader.onloadend = function () {
            var result = String(reader.result || "");
            var comma = result.indexOf(",");
            if (comma > 0) {
              save(name, blob.type, result.substring(comma + 1));
            }
          };
          reader.readAsDataURL(blob);
          return;
        }
      }
    } catch (error) {
      /* fall through to the original behaviour */
    }
    return click.apply(this, arguments);
  };
})();
