import { afterEach, describe, expect, it, vi } from "vitest";
import { mount, type VueWrapper } from "@vue/test-utils";
import VirtualJoystick from "@/components/city/VirtualJoystick.vue";
import MobileRunButton from "@/components/city/MobileRunButton.vue";

const wrappers: VueWrapper[] = [];
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()));
function render() {
  const wrapper = mount(VirtualJoystick);
  wrappers.push(wrapper);
  const base = wrapper.element as HTMLButtonElement;
  vi.spyOn(base, "getBoundingClientRect").mockReturnValue(
    new DOMRect(0, 0, 120, 120),
  );
  base.setPointerCapture = vi.fn();
  base.hasPointerCapture = vi.fn(() => true);
  base.releasePointerCapture = vi.fn();
  return wrapper;
}
function lastMove(wrapper: VueWrapper) {
  const moves = wrapper.emitted("move")!;
  return moves[moves.length - 1]![0] as { x: number; z: number };
}

describe("모바일 조이스틱", () => {
  it("달리기를 전환하고 화면을 벗어나면 해제할 수 있다.", async () => {
    const wrapper = mount(MobileRunButton);
    wrappers.push(wrapper);
    await wrapper.trigger("click");
    expect(wrapper.attributes("aria-pressed")).toBe("true");
    expect(wrapper.emitted("change")![0]).toEqual([true]);
    await wrapper.setProps({ disabled: true });
    expect(wrapper.attributes("aria-pressed")).toBe("false");
    expect(wrapper.emitted("change")![1]).toEqual([false]);
  });
  it("작은 흔들림을 무시하고 대각선 입력을 최대 속도 이내로 제한할 수 있다.", async () => {
    const wrapper = render();
    await wrapper.trigger("pointerdown", {
      pointerId: 1,
      button: 0,
      clientX: 60,
      clientY: 60,
    });
    await wrapper.trigger("pointermove", {
      pointerId: 1,
      clientX: 62,
      clientY: 61,
    });
    expect(lastMove(wrapper)).toEqual({ x: 0, z: 0 });
    await wrapper.trigger("pointermove", {
      pointerId: 1,
      clientX: 560,
      clientY: -440,
    });
    const input = lastMove(wrapper);
    expect(input.x).toBeCloseTo(Math.SQRT1_2);
    expect(input.z).toBeCloseTo(-Math.SQRT1_2);
    expect(Math.hypot(input.x, input.z)).toBeCloseTo(1);
    await wrapper.trigger("pointerup", { pointerId: 1 });
    expect(lastMove(wrapper)).toEqual({ x: 0, z: 0 });
  });

  it("다른 손가락의 입력을 무시하고 터치 취소 시 멈출 수 있다.", async () => {
    const wrapper = render();
    await wrapper.trigger("pointerdown", {
      pointerId: 1,
      button: 0,
      clientX: 96,
      clientY: 60,
    });
    const before = wrapper.emitted("move")!.length;
    await wrapper.trigger("pointerdown", {
      pointerId: 2,
      button: 0,
      clientX: 24,
      clientY: 60,
    });
    await wrapper.trigger("pointermove", {
      pointerId: 2,
      clientX: 24,
      clientY: 60,
    });
    await wrapper.trigger("pointerup", { pointerId: 2 });
    expect(wrapper.emitted("move")).toHaveLength(before);
    expect(lastMove(wrapper)).toEqual({ x: 1, z: 0 });
    await wrapper.trigger("pointercancel", { pointerId: 1 });
    expect(lastMove(wrapper)).toEqual({ x: 0, z: 0 });
  });

  it("창이 열리거나 포커스를 잃으면 이동을 해제할 수 있다.", async () => {
    const wrapper = render();
    await wrapper.trigger("pointerdown", {
      pointerId: 1,
      button: 0,
      clientX: 96,
      clientY: 60,
    });
    await wrapper.setProps({ disabled: true });
    expect(lastMove(wrapper)).toEqual({ x: 0, z: 0 });
    await wrapper.trigger("pointermove", {
      pointerId: 1,
      clientX: 96,
      clientY: 60,
    });
    expect(lastMove(wrapper)).toEqual({ x: 0, z: 0 });
    await wrapper.setProps({ disabled: false });
    await wrapper.trigger("pointerdown", {
      pointerId: 2,
      button: 0,
      clientX: 60,
      clientY: 96,
    });
    window.dispatchEvent(new Event("blur"));
    expect(lastMove(wrapper)).toEqual({ x: 0, z: 0 });
  });
});
