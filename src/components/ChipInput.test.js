import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import ChipInput from "./ChipInput";

function Controlled({ initial = [], onChange = () => {} }) {
  const [chips, setChips] = useState(initial);
  return (
    <ChipInput
      label="Stack principal"
      hint="enter adiciona"
      chips={chips}
      onChange={(next) => {
        setChips(next);
        onChange(next);
      }}
      placeholder="adicionar tecnologia"
    />
  );
}

const input = () => screen.getByRole("textbox", { name: /stack principal/i });
const chipTexts = () => screen.queryAllByRole("listitem").map((li) => li.textContent);

function type(value) {
  fireEvent.change(input(), { target: { value } });
}

describe("ChipInput", () => {
  it("o input é rotulado pelo label (label + input reais)", () => {
    render(<Controlled />);
    expect(input().tagName).toBe("INPUT");
  });

  it("Enter adiciona o chip e limpa o campo", () => {
    render(<Controlled />);
    type("  Python ");
    fireEvent.keyDown(input(), { key: "Enter" });
    expect(chipTexts()).toEqual(["Python"]);
    expect(input()).toHaveValue("");
  });

  it("vírgula também adiciona", () => {
    render(<Controlled />);
    type("FastAPI");
    fireEvent.keyDown(input(), { key: "," });
    expect(chipTexts()).toEqual(["FastAPI"]);
  });

  it("ignora vazio e duplicata (sem diferenciar maiúsculas)", () => {
    const onChange = jest.fn();
    render(<Controlled initial={["Python"]} onChange={onChange} />);
    type("   ");
    fireEvent.keyDown(input(), { key: "Enter" });
    type("python");
    fireEvent.keyDown(input(), { key: "Enter" });
    expect(chipTexts()).toEqual(["Python"]);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("o × remove o chip correspondente", () => {
    render(<Controlled initial={["Python", "FastAPI", "PostgreSQL"]} />);
    fireEvent.click(screen.getByRole("button", { name: "Remover FastAPI" }));
    expect(chipTexts()).toEqual(["Python", "PostgreSQL"]);
  });

  it("Backspace com o campo vazio remove o último chip", () => {
    render(<Controlled initial={["Python", "FastAPI"]} />);
    fireEvent.keyDown(input(), { key: "Backspace" });
    expect(chipTexts()).toEqual(["Python"]);
  });

  it("Backspace com texto no campo não remove chip", () => {
    render(<Controlled initial={["Python"]} />);
    type("Fast");
    fireEvent.keyDown(input(), { key: "Backspace" });
    expect(chipTexts()).toEqual(["Python"]);
  });

  it("sair do campo com texto pendente adiciona o chip", () => {
    render(<Controlled />);
    type("Docker");
    fireEvent.blur(input());
    expect(chipTexts()).toEqual(["Docker"]);
  });
});
