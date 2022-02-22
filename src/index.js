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

const render = (element, container) => {
  const dom =
    element.type === TEXT_ELEMENT
      ? document.createTextNode("")
      : document.createElement(element.type)

  Object.keys(element.props)
    .filter((key) => key !== "children")
    .forEach((propName) => {
      dom[propName] = element.props[propName]
    })

  element.props.children.forEach((child) => render(child, dom))

  container.appendChild(dom)
}

const Zorro = {
  createElement,
  createTextElement,
  render,
}

const element = (
  <h1 data-e2e-id="header">
    <span>Hello I'm header</span>
  </h1>
)

const container = document.getElementById("root")
render(element, container)
