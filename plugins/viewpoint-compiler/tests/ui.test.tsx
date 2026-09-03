// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "../ui/src/App";

describe("editor fallback", () => {
  it("explains how to open a project when no host result is available", () => {
    render(<App />);
    expect(screen.getByText("Viewpoint Compiler")).toBeTruthy();
    expect(screen.getByText(/open_viewpoint_editor/)).toBeTruthy();
  });
});

