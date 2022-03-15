const TEXT_ELEMENT = "TEXT_ELEMENT"

const createTextElement = (text) => ({
  type: TEXT_ELEMENT,
  props: {
    nodeValue: text,
    children: [],
  },
})

const createElement = (type, props, ...children) => ({
  type,
  props: {
    ...props,
    children: children.map((child) =>
      typeof child === "object" ? child : createTextElement(child)
    ),
  },
})

const createDom = (fiber) => {
  const dom =
    element.type === TEXT_ELEMENT
      ? document.createTextNode("")
      : document.createElement(fiber.type)

  Object.keys(fiber.props)
    .filter((key) => key !== "children")
    .forEach((propName) => {
      dom[propName] = fiber.props[propName]
    })

  return dom
}

function workLoop(deadline) {
  let shouldYield = false
  while (nextUnitOfWork && !shouldYield) {
    nextUnitOfWork = performUnitOfWork(nextUnitOfWork)
    shouldYield = deadline.timeRemaining() < 1
  }

  if (!nextUnitOfWork && wipRoot) {
    commitRoot()
  }
  requestIdleCallback(workLoop)
}

requestIdleCallback(workLoop)

function performUnitOfWork(fiber) {
  if (!fiber.dom) {
    fiber.dom = createDom(fiber)
  }

  if (fiber.parent) {
    fiber.parent.dom.appendChild(fiber.dom)
  }

  const elements = fiber.props.children
  reconcileChildren(fiber, elements)
  while (nextFiber) {
    if (nextFiber.sibling) {
      return nextFiber.sibling
    }
    nextFiber = nextFiber.parent
  }
}

function reconcileChildren(wipFiber, elements) {
  let index = 0
  let oldFiber = wipFiber.alternate ? wipFiber.alternate.child : null
  let prevSibling = null

  while (index < elements.length || oldFiber != null) {
    const element = elements[index]
    // TODO implement createFiber
    const newFiber = element && createFiber(element, wipFiber.mode, oldFiber)

    const sameType = oldFiber && element && element.type === oldFiber.type

    if (sameType) {
      newFiber = {
        type: oldFiber.type,
        props: element.props,
        dom: oldFiber.dom,
        parent: wipFiber,
        alternate: oldFiber,
        effectTag: "UPDATE",
      }
    }

    if (!sameType) {
      newFiber = {
        type: newFiber.type,
        props: element.props,
        dom: null,
        parent: wipFiber,
        alternate: null,
        effectTag: "PLACEMENT",
      }
    }

    if (oldFiber && !sameType) {
      oldFiber.effectTag = "DELETION"
      deletions.push(oldFiber)
    }
  }
}

function render(element, container) {
  wipRoot = {
    dom: container,
    props: {
      children: [element],
    },
    alternate: currentRoot,
  }
  deletions = []
  nextUnitOfWork = wipRoot
}

function commitRoot() {
  deletions.forEach((fiber) => commitWork(fiber))
  commitWork(wipRoot.child)
  currentRoot = wipRoot
  wipRoot = null
}

function commitWork(fiber) {
  if (!fiber) {
    return
  }

  const domParent = fiber.parent.dom
  if (fiber.effectTag === "UPDATE" && fiber.dom != null) {
    updateDom(fiber.dom, fiber.alternate.props, fiber.props)
  } else if (fiber.effectTag === "PLACEMENT" && fiber.dom !== null) {
    domParent.appendChild(fiber.dom)
  } else if (fiber.effectTag === "DELETION") {
    domParent.removeChild(fiber.dom)
  }

  commitWork(fiber.child)
  commitWork(fiber.sibling)
}

const isEvent = (key) => key.startsWith("on")
const isValidProp = (key) => key !== "children" && !isEvent(key)
const isNotPresent = (prev, next) => (key) => !(key in next)
const isNewProp = (prev, next) => (key) => prev[key] !== next[key]

function updateDom(dom, oldProps, newProps) {
  //remove old event listeners
  Object.keys(oldProps)
    .filter(isEvent)
    .filter((key) => !(key in newProps) || isNewProp(oldProps, newProps)(key))
    .forEach((key) => {
      const eventName = key.toLowerCase().substring(2)
      dom.removeEventListener(eventName, oldProps[key])
    })
  // remove old props
  Object.keys(oldProps)
    .filter((key) => key !== "children")
    .filter(isNotPresent)
    .forEach((name) => (dom[name] = ""))

  // add new props
  Object.keys(newProps)
    .filter((key) => key !== "children")
    .filter(isNewProp)
    .forEach((name) => (dom[name] = newProps[name]))

  // add new event listeners
  Object.keys(newProps)
    .filter(isEvent)
    .filter(isNewProp)
    .forEach((key) => {
      const eventName = key.toLowerCase().substring(2)
      dom.addEventListener(eventName, newProps[key])
    })
}

let nextUnitOfWork = null
let wipRoot = null
let currentRoot = null
let deletions = []

const Zorro = {
  createElement,
  createTextElement,
  render,
}

const element = (
  <h1 data-e2e-id="header">
    <span onClick={() => console.log("hehe")}>Hello I'm header</span>
  </h1>
)

const container = document.getElementById("root")
render(element, container)
