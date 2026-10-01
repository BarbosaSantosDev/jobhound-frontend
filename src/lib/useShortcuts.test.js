import { fireEvent, render } from "@testing-library/react";
import { useShortcuts } from "./useShortcuts";

function Harness({ bindings, enabled }) {
  useShortcuts(bindings, { enabled });
  return (
    <div>
      <input aria-label="busca" />
      <input aria-label="aceito" type="checkbox" />
      <textarea aria-label="resumo" />
    </div>
  );
}

function setup(enabled = true) {
  const bindings = { s: jest.fn(), c: jest.fn(), x: jest.fn(), "/": jest.fn(), ArrowDown: jest.fn(), ArrowUp: jest.fn() };
  const utils = render(<Harness bindings={bindings} enabled={enabled} />);
  return { bindings, ...utils };
}

describe("useShortcuts", () => {
  it("dispara S, C, X, / e as setas quando o foco não está num campo", () => {
    const { bindings } = setup();
    for (const key of ["s", "c", "x", "/", "ArrowDown", "ArrowUp"]) {
      fireEvent.keyDown(document.body, { key });
    }
    for (const fn of Object.values(bindings)) expect(fn).toHaveBeenCalledTimes(1);
  });

  it("não diferencia maiúscula de minúscula", () => {
    const { bindings } = setup();
    fireEvent.keyDown(document.body, { key: "S" });
    expect(bindings.s).toHaveBeenCalledTimes(1);
  });

  it("ignora teclas digitadas em input de texto e textarea", () => {
    const { bindings, getByLabelText } = setup();
    fireEvent.keyDown(getByLabelText("busca"), { key: "s" });
    fireEvent.keyDown(getByLabelText("resumo"), { key: "/" });
    expect(bindings.s).not.toHaveBeenCalled();
    expect(bindings["/"]).not.toHaveBeenCalled();
  });

  it("funciona com foco num checkbox (não é campo de texto)", () => {
    const { bindings, getByLabelText } = setup();
    fireEvent.keyDown(getByLabelText("aceito"), { key: "x" });
    expect(bindings.x).toHaveBeenCalledTimes(1);
  });

  it("deixa passar atalhos do navegador (Ctrl/Cmd/Alt)", () => {
    const { bindings } = setup();
    fireEvent.keyDown(document.body, { key: "s", ctrlKey: true });
    fireEvent.keyDown(document.body, { key: "c", metaKey: true });
    expect(bindings.s).not.toHaveBeenCalled();
    expect(bindings.c).not.toHaveBeenCalled();
  });

  it("previne o comportamento padrão só das teclas tratadas", () => {
    setup();
    const handled = fireEvent.keyDown(document.body, { key: "/" });
    const ignored = fireEvent.keyDown(document.body, { key: "q" });
    expect(handled).toBe(false); // preventDefault chamado
    expect(ignored).toBe(true);
  });

  it("não faz nada quando desabilitado", () => {
    const { bindings } = setup(false);
    fireEvent.keyDown(document.body, { key: "s" });
    expect(bindings.s).not.toHaveBeenCalled();
  });
});
