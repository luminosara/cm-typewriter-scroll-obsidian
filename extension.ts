import { Extension, Transaction, Facet } from "@codemirror/state"
import { ViewPlugin, ViewUpdate, EditorView } from "@codemirror/view"
declare type ScrollStrategy = "nearest" | "start" | "end" | "center";

const allowedUserEvents = /^(select|input|delete|undo|redo)(\..+)?$/
const disallowedUserEvents = /^(select.pointer)$/

const typewriterOffset = Facet.define<number, number>({
  combine: values => values.length ? Math.min(...values) : 0.5
})


const paddingOption = Facet.define<boolean, boolean>({
  combine: values => values.length ? values[0] : true
})

const fixBottomOnly = Facet.define<boolean, boolean>({
  combine: values => values.length ? values[0] : false
})


const resetTypewriterScrollPaddingPlugin = ViewPlugin.fromClass(class {
  constructor(private view: EditorView) { }

  update(update: ViewUpdate) {
    if (this.view.contentDOM.style.paddingTop) {
      this.view.contentDOM.style.paddingTop = ""
      this.view.contentDOM.style.paddingBottom = (update.view.dom.clientHeight / 2) + "px";
    }
  }
})

const typewriterScrollPaddingPlugin = ViewPlugin.fromClass(class {
  private topPadding: string = null;

  constructor(private view: EditorView) { }

  update(update: ViewUpdate) {
    if (!update.view.state.facet(paddingOption)) return;
    const offset = (update.view.dom.clientHeight * update.view.state.facet(typewriterOffset)) - (update.view.defaultLineHeight / 2)
    this.topPadding = offset + "px"
    if (this.topPadding != this.view.contentDOM.style.paddingTop) {
      this.view.contentDOM.style.paddingTop = this.topPadding
      this.view.contentDOM.style.paddingBottom = (update.view.dom.clientHeight - offset) + "px";
    }
  }
})

const typewriterScrollPlugin = ViewPlugin.fromClass(class {
  private myUpdate = false;
  
  constructor(private view: EditorView) { }

  update(update: ViewUpdate) {
    if (this.myUpdate) this.myUpdate = false;
    else {
      const userEvents = update.transactions.map(tr => tr.annotation(Transaction.userEvent))
      const isAllowed = userEvents.reduce<boolean>(
        (result, event) => result && allowedUserEvents.test(event) && !disallowedUserEvents.test(event),
        userEvents.length > 0
      );
      if (isAllowed) {
        this.myUpdate = true;
        this.centerOnHead(update)
      }
    }
  }

  async centerOnHead(update: ViewUpdate) {
    // can't update inside an update, so request the next animation frame
    window.requestAnimationFrame(() => {
      // current selection range
      if (update.state.selection.ranges.length == 1) {
        // only act on the one range
        const head = update.state.selection.main.head;
        const prevHead = update.startState.selection.main.head;
        // TODO: work out line number and use that instead? Is that even possible?
        // don't bother with this next part if the range (line??) hasn't changed
        if (prevHead != head) {
          // this is the effect that does the centering
          const coor = update.view.coordsAtPos(update.state.selection.main.head, -1);
          // don't why the coordinates get from coordsAsPos can't coincide with clientHeight
          const hightPos = coor.top - 100;
          console.debug(`clientTop: ${update.view.dom.clientTop}, clientHeight: ${update.view.dom.clientHeight}, coor: ${coor.top}, ${coor.bottom}`);
          if ((hightPos / update.view.dom.clientHeight) < update.view.state.facet(typewriterOffset) && update.view.state.facet(fixBottomOnly)) {
            return;
          }
          let offset = (update.view.dom.clientHeight * update.view.state.facet(typewriterOffset)) - (update.view.defaultLineHeight / 2);
          const effect = EditorView.scrollIntoView(head, { y: "start", yMargin: offset });
          // const effect = EditorView.scrollIntoView(head, { y: "center" });
          const transaction = this.view.state.update({ effects: effect });
          this.view.dispatch(transaction)
        }
      }
    })
  }
})

export function typewriterScroll(options: { typewriterOffset?: number, paddingOption?: boolean, fixBottomOnly?: boolean } = {}): Extension {
  return [
    options.typewriterOffset == null ? [] : typewriterOffset.of(options.typewriterOffset),
    options.paddingOption == null ? [] : paddingOption.of(options.paddingOption),
    options.fixBottomOnly == null ? [] : fixBottomOnly.of(options.fixBottomOnly),
    typewriterScrollPaddingPlugin,
    typewriterScrollPlugin
  ]
}

export function resetTypewriterSrcoll(): Extension {
  return [
    resetTypewriterScrollPaddingPlugin
  ]
}