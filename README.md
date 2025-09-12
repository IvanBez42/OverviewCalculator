# <img src="/calculator_icon.svg" alt="calculator_icon" width="25" /> Overview Calculator

This project is a Gnome Extension to create a calculator for the Gnome overview. When users insert a math expression into the overview search bar, the answer will appear and, once selected, will automatically be copied to the clipboard.

This project will be actively maintained.

### Depencies

This project requires either [bc](https://man.archlinux.org/man/bc.1) or [qalc](https://man.archlinux.org/man/qalc.1.en) to compute the mathematical expressions. The program uses `qalc` by default but falls back to `bc`.

- `qalc` is more powerful, includes better decimal handling and more operators.
- `bc` is included by default in a majority of Linux distros.
  This project will be actively maintained.
