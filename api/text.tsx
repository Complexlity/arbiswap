//@ts-nocheck
import { Frog } from 'frog'
import { Child, JSXNode } from 'hono/jsx'
import lz from 'lz-string'

const compressedImage = lz.compressToEncodedURIComponent(
  JSON.stringify(
    await parseImage(
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          width: "100%",
		}}
				
      >

      </div>,
      {
        assetsUrl,
        ui: {
          ...this.ui,
          vars: {
            ...this.ui?.vars,
            frame: {
              height: imageOptions?.height!,
              width: imageOptions?.width!,
            },
          },
        },
      }
    )
  )
);


async function parseImage(
  node_: Child,
  options: {
    assetsUrl: string;
    ui: Frog["ui"] & { direction?: Direction | undefined };
  }
): Promise<Child> {
  const { assetsUrl, ui } = options;

  if (typeof node_ !== "object") return node_;
  if (Array.isArray(node_))
    return (await Promise.all(
      node_.map(async (e) => await parseImage(e, { assetsUrl, ui }))
    )) as Child;
  if (node_ instanceof Promise) return await node_;

  if (node_ === null) return null;

  let node = node_;
  const direction =
    (node.tag as unknown as { direction: Direction } | undefined)?.direction ??
    options.ui.direction ??
    (node.props.flexDirection
      ? node.props.flexDirection === "column"
        ? "horizontal"
        : "vertical"
      : undefined);

  if (typeof node.tag === "function") {
    node = await node.tag({
      ...node.props,
      __context: {
        direction,
        vars: { ...node.props?.__context?.vars, ...ui?.vars },
      },
      children: node.children,
    });
    node.props.__context = undefined;
    node = (await parseImage(node, {
      assetsUrl,
      ui: { ...ui, direction },
    })) as JSXNode;
  }
  if (node.children)
    node.children = await Promise.all(
      node.children.map(
        async (e) =>
          await parseImage(e, { assetsUrl, ui: { ...ui, direction } })
      )
    );
  if (node.tag === "img") {
    const src = node.props.src;
    if (src.startsWith("/")) node.props.src = `${assetsUrl + parsePath(src)}`;
  }

  return node;
}


function parsePath(path_: string): string {
  let path = path_.split("?")[0]!;
  if (path.endsWith("/")) path = path.slice(0, -1);
  return path;
}
