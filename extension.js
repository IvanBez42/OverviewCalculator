import St from "gi://St";
import Gio from "gi://Gio";
const GLib = imports.gi.GLib;
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";

class SearchCalculator {
  /* Create search function */
  constructor(path) {
    this.path = path;
  }

  /* Click on result */
  activateResult(result) {
    const [_prefix, _express, res] = result.split(":");
    try {
      const clipboard = St.Clipboard.get_default();
      clipboard.set_text(St.ClipboardType.CLIPBOARD, res);
    } catch (e) {
      logError(e, "SearchCalculator.activateResult");
    }
  }

  /* Results are processed */
  getInitialResultSet(terms) {
    const { result, expr } = this._compute(terms);
    if (result === null) return Promise.resolve([]);
    return Promise.resolve([
      `calc:${encodeURIComponent(expr)}:${encodeURIComponent(result)}`,
    ]);
  }

  getSubsearchResultSet(_prev, terms) {
    return this.getInitialResultSet(terms);
  }

  /* Create entry */
  getResultMetas(ids) {
    const metas = ids.map((id) => {
      const [_prefix, encExpr, encRes] = id.split(":");
      const expr = decodeURIComponent(encExpr ?? "");
      const res = decodeURIComponent(encRes ?? "");
      return {
        id,
        name: res,
        description: `= ${expr}`,
        createIcon: (size) =>
          new St.Icon({
            /* Custom Free Icon */
            gicon: new Gio.FileIcon({
              file: Gio.File.new_for_path(`${this.path}/calculator_icon.svg`),
            }),
            icon_size: size,
          }),
      };
    });
    return Promise.resolve(metas);
  }

  /* Filter when to show */
  filterResults(providerResults, maxResults) {
    if (!providerResults) return [];
    return providerResults.slice(0, Math.max(1, maxResults ?? 1));
  }

  _compute(terms) {
    /* Format search terms */
    const query = (terms ?? []).join(" ").trim();
    let expr = query.startsWith("=") ? query.slice(1) : query;
    expr = expr.trim();
    if (!expr) return { result: null, expr: "" };

    /* Check what math engine to use */
    const hasQalc = GLib.find_program_in_path("qalc") !== null;
    let command;
    if (hasQalc) {
      command = `qalc -t "${expr}"`;
    } else {
      command = `/bin/sh -c "echo '${expr}' | bc -l"`;
    }

    /* Valid expression return */
    try {
      let [ok, out, err, status] = GLib.spawn_command_line_sync(command);
      if (ok && status === 0) {
        return { result: out.toString().trim(), expr };
      }
    } catch (e) {}
    return { result: null, expr };
  }
}

export default class OverviewCalculator extends Extension {
  /* Start the calculator search */
  enable() {
    this.search = new SearchCalculator(this.path);
    Main.overview.searchController.addProvider(this.search);
  }

  /* Stop the calculator search */
  disable() {
    if (this.search) {
      try {
        Main.overview.searchController.removeProvider(this.search);
      } catch (e) {
        log(e);
      }
      this.search = null;
    }
  }
}
