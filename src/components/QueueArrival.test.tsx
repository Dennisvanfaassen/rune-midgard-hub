import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { QueueArrival } from "@/components/QueueArrival";

afterEach(cleanup);
it("shows the arriving character and provides accessible open and dismiss actions", () => {
  const view = vi.fn(),
    dismiss = vi.fn();
  render(
    <QueueArrival
      entries={[
        {
          id: "1",
          user_id: "2",
          char_name: "Lute",
          job: "Bard",
          base_lv: 70,
          role: "Bragi",
          activity: "Leveling",
          location: "Geffen",
          note: "",
          joined_at: "",
          expires_at: "",
        },
      ]}
      onView={view}
      onDismiss={dismiss}
    />,
  );
  expect(screen.getByRole("heading", { name: "A guildmate is ready!" })).toBeInTheDocument();
  expect(screen.getByText("Lute")).toBeInTheDocument();
  expect(screen.getByText(/Lv. 70 Bard/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "View available guildmates" }));
  expect(view).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("button", { name: "Dismiss queue alert" }));
  expect(dismiss).toHaveBeenCalledOnce();
});
