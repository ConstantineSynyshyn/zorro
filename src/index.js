const TEXT_ELEMENT = "TEXT_ELEMENT"
const EFFECT_TAG = {
  PLACEMENT: "PLACEMENT",
  DELETION: "DELETION",
  UPDATE: "UPDATE",
}

let wipFiber = null
let hookIndex = null
let nextUnitOfWork = null
let currentRoot = null
let wipRoot = null
let deletions = null

function createElement(type, props, ...children) {
  return {
    type,
    props: {
      ...props,
      children: children
        .flat()
        .map((child) =>
          typeof child === "object" ? child : createTextElement(child)
        ),
    },
  }
}

function createTextElement(text) {
  return {
    type: TEXT_ELEMENT,
    props: {
      nodeValue: text,
      children: [],
    },
  }
}

function createDom(fiber) {
  const dom =
    fiber.type == TEXT_ELEMENT
      ? document.createTextNode("")
      : document.createElement(fiber.type)

  updateDom(dom, {}, fiber.props)

  return dom
}

const isEvent = (key) => key.startsWith("on")
const isProperty = (key) => key !== "children" && !isEvent(key)
const isNew = (prev, next) => (key) => prev[key] !== next[key]
const isGone = (prev, next) => (key) => !(key in next)

function updateDom(dom, prevProps, nextProps) {
  //Remove old or changed event listeners
  Object.keys(prevProps)
    .filter(isEvent)
    .filter((key) => !(key in nextProps) || isNew(prevProps, nextProps)(key))
    .forEach((name) => {
      const eventType = name.toLowerCase().substring(2)
      dom.removeEventListener(eventType, prevProps[name])
    })

  // Remove old properties
  Object.keys(prevProps)
    .filter(isProperty)
    .filter(isGone(prevProps, nextProps))
    .forEach((name) => {
      dom[name] = ""
    })

  // Set new or changed properties
  Object.keys(nextProps)
    .filter(isProperty)
    .filter(isNew(prevProps, nextProps))
    .forEach((name) => {
      if (name === "style") {
        // update style
        transformDomStyle(dom, nextProps.style)
      } else if (name === "className") {
        // update className
        prevProps.className &&
          dom.classList.remove(...prevProps.className.split(/\s+/))
        dom.classList.add(...nextProps.className.split(/\s+/))
      } else {
        dom[name] = nextProps[name]
      }
    })

  // Add event listeners
  Object.keys(nextProps)
    .filter(isEvent)
    .filter(isNew(prevProps, nextProps))
    .forEach((name) => {
      const eventType = name.toLowerCase().substring(2)
      dom.addEventListener(eventType, nextProps[name])
    })
}

const reg = /[A-Z]/g
function transformDomStyle(dom, style) {
  dom.style = Object.keys(style).reduce((acc, styleName) => {
    const key = styleName.replace(reg, function (v) {
      return "-" + v.toLowerCase()
    })
    acc += `${key}: ${style[styleName]};`
    return acc
  }, "")
}

function commitRoot() {
  deletions.forEach(commitWork)
  commitWork(wipRoot.child)
  currentRoot = wipRoot
  wipRoot = null
}

function commitWork(fiber) {
  if (!fiber) {
    return
  }

  let domParentFiber = fiber.parent
  while (!domParentFiber.dom) {
    domParentFiber = domParentFiber.parent
  }
  const domParent = domParentFiber.dom

  if (fiber.effectTag === EFFECT_TAG.PLACEMENT && fiber.dom != null) {
    domParent.appendChild(fiber.dom)
  } else if (fiber.effectTag === EFFECT_TAG.UPDATE && fiber.dom != null) {
    updateDom(fiber.dom, fiber.alternate.props, fiber.props)
    domParent.appendChild(fiber.dom)
  } else if (fiber.effectTag === EFFECT_TAG.DELETION) {
    commitDeletion(fiber, domParent)
    return
  }

  commitWork(fiber.child)
  commitWork(fiber.sibling)
}

function commitDeletion(fiber, domParent) {
  if (fiber.dom) {
    domParent.removeChild(fiber.dom)
  } else {
    commitDeletion(fiber.child, domParent)
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
  const isFunctionComponent = fiber.type instanceof Function
  if (isFunctionComponent) {
    updateFunctionComponent(fiber)
  } else {
    updateHostComponent(fiber)
  }
  if (fiber.child) {
    return fiber.child
  }
  let nextFiber = fiber
  while (nextFiber) {
    if (nextFiber.sibling) {
      return nextFiber.sibling
    }
    nextFiber = nextFiber.parent
  }
}

function updateFunctionComponent(fiber) {
  wipFiber = fiber
  hookIndex = 0
  wipFiber.hooks = []
  const children = [fiber.type(fiber.props)]
  reconcileChildren(fiber, children)
}

function useState(initial) {
  const oldHook =
    wipFiber.alternate &&
    wipFiber.alternate.hooks &&
    wipFiber.alternate.hooks[hookIndex]
  const hook = {
    state: oldHook ? oldHook.state : initial,
    queue: [],
  }

  const actions = oldHook ? oldHook.queue : []
  actions.forEach((action) => {
    hook.state = action(hook.state)
  })

  const setState = (action) => {
    hook.queue.push(action)
    wipRoot = {
      dom: currentRoot.dom,
      props: currentRoot.props,
      alternate: currentRoot,
    }
    nextUnitOfWork = wipRoot
    deletions = []
  }

  wipFiber.hooks.push(hook)
  hookIndex++
  return [hook.state, setState]
}

function updateHostComponent(fiber) {
  if (!fiber.dom) {
    fiber.dom = createDom(fiber)
  }
  reconcileChildren(fiber, fiber.props.children)
}

function reconcileChildren(wipFiber, elements) {
  let index = 0
  let oldFiber = wipFiber.alternate && wipFiber.alternate.child
  let prevSibling = null

  while (index < elements.length || oldFiber != null) {
    const element = elements[index]
    let newFiber = null

    const sameType = oldFiber && element && element.type == oldFiber.type

    if (sameType) {
      newFiber = {
        type: oldFiber.type,
        props: element.props,
        dom: oldFiber.dom,
        parent: wipFiber,
        alternate: oldFiber,
        effectTag: EFFECT_TAG.UPDATE,
      }
    }
    if (element && !sameType) {
      newFiber = {
        type: element.type,
        props: element.props,
        dom: null,
        parent: wipFiber,
        alternate: null,
        effectTag: EFFECT_TAG.PLACEMENT,
      }
    }
    if (oldFiber && !sameType) {
      oldFiber.effectTag = EFFECT_TAG.DELETION
      deletions.push(oldFiber)
    }

    if (oldFiber) {
      oldFiber = oldFiber.sibling
    }

    if (index === 0) {
      wipFiber.child = newFiber
    } else if (element) {
      prevSibling.sibling = newFiber
    }

    prevSibling = newFiber
    index++
  }
}

const Zorro = {
  createElement,
  render,
}

function Counter() {
  const [state, setState] = useState(1)
  return (
    <div>
      <h1 style={{ marginTop: "100px", textAlign: "center" }} test="test">
        Count: {state}
      </h1>
      <div style={{ display: "flex", justifyContent: "center" }}>
        <button onClick={() => setState((c) => c + 1)}>Inc</button>
      </div>
    </div>
  )
}

const element = <Counter />
const container = document.getElementById("root")
Zorro.render(element, container)
