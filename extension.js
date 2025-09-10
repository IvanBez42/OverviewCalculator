import St from "gi://St";
import Gio from "gi://Gio";
import GLib from "gi://GLib";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";

class SearchCalculator {
  /* Create search function */
  constructor(path) {
    this.path = path;
  }

  /* Click on result */
  activateResult(result) {
    const [_prefix, _express, encRes] = result.split(":");
    try {
      const res = decodeURIComponent(encRes ?? "");
      const clipboard = St.Clipboard.get_default();
      clipboard.set_text(St.ClipboardType.CLIPBOARD, res);
    } catch (e) {
      logError(e, "SearchCalculator.activateResult");
    }
  }

  /* Results are processed */
  getInitialResultSet(terms) {
    return this._compute(terms);
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

  /* Async subproccess to prevent ui freeze */
  _subAsync(subprocess, input) {
    return new Promise((resolve, reject) => {
      subprocess.communicate_utf8_async(input ?? null, null, (proc, res) => {
        try {
          const [ok, out, err] = proc.communicate_utf8_finish(res);
          resolve({ ok, out, err });
        } catch (e) {
          reject(e);
        }
      });
    });
  }

  async _compute(terms) {
    /* Format search terms */
    const query = (terms ?? []).join(" ").trim();
    let expr = query.startsWith("=") ? query.slice(1) : query;
    expr = expr.trim();
    if (!expr) return Promise.resolve([]);

    /* Check what math engine to use */
    const hasQalc = GLib.find_program_in_path("qalc") !== null;

    try {
      let stdout = "";
      let stderr = "";
      let subprocess;

      if (hasQalc) {
        /* Input expr */
        subprocess = new Gio.Subprocess({
          argv: ["qalc", "-t", expr],
          flags:
            Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
        });
        subprocess.init(null);
        const { out, err } = await this._subAsync(subprocess, null);
        stdout = (out ?? "").trim();
        stderr = (err ?? "").trim();
      } else {
        /* Pipe in expr rather than input */
        subprocess = new Gio.Subprocess({
          argv: ["bc", "-l"],
          flags:
            Gio.SubprocessFlags.STDIN_PIPE |
            Gio.SubprocessFlags.STDOUT_PIPE |
            Gio.SubprocessFlags.STDERR_PIPE,
        });
        subprocess.init(null);
        const { out, err } = await this._subAsync(subprocess, expr + "\n");
        stdout = (out ?? "").trim();
        stderr = (err ?? "").trim();
      }

      /* Validate process success and output */
      let success = true;
      try {
        const exited = subprocess.get_if_exited
          ? subprocess.get_if_exited()
          : true;
        const status = subprocess.get_exit_status
          ? subprocess.get_exit_status()
          : 0;
        success = exited && status === 0;
      } catch (_e) {
        success = true;
      }

      if (success && stdout && !stderr) {
        return Promise.resolve([
          `calc:${encodeURIComponent(expr)}:${encodeURIComponent(stdout)}`,
        ]);
      }
    } catch (e) {
      logError(e, "SearchCalculator._compute");
    }
    return Promise.resolve([]);
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
      Main.overview.searchController.removeProvider(this.search);
      this.search = null;
    }
  }
}
