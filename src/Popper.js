// @flow
import deepEqual from "deep-equal";
import * as React from 'react';
import PopperJS, {
  type Placement,
  type Instance,
  type Data,
  type Modifiers,
  type ReferenceObject,
} from 'popper.js';
import type { Style } from 'typed-styles';
import { ManagerReferenceNodeContext } from './Manager';
import { unwrapArray, setRef, shallowEqual } from './utils';
import { type Ref } from "./RefTypes";

type ReferenceElement = ReferenceObject | HTMLElement | null;
type StyleOffsets = { top: number, left: number };
type StylePosition = { position: 'absolute' | 'fixed' };

export type PopperArrowProps = {
  ref: Ref,
  style: StyleOffsets & Style,
};
export type PopperChildrenProps = {|
  ref: Ref,
  style: StyleOffsets & StylePosition & Style,
  placement: Placement,
  outOfBoundaries: ?boolean,
  scheduleUpdate: () => void,
  arrowProps: PopperArrowProps,
|};
export type PopperChildren = PopperChildrenProps => React.Node;

export type PopperProps = {
  children: PopperChildren,
  eventsEnabled?: boolean,
  innerRef?: Ref,
  modifiers?: Modifiers,
  placement?: Placement,
  positionFixed?: boolean,
  referenceElement?: ReferenceElement,
};

type PopperState = {
  style: Object,
  placement: ?Placement,
  arrowStyle: ?Object,
  outOfBoundaries: ?boolean,
};

const initialStyle = {
  position: 'absolute',
  top: 0,
  left: 0,
  opacity: 0,
  pointerEvents: 'none',
};

const initialArrowStyle = {};

export class InnerPopper extends React.Component<PopperProps, PopperState> {
  static defaultProps = {
    placement: 'bottom',
    eventsEnabled: true,
    referenceElement: undefined,
    positionFixed: false,
  };

  state = {
    style: initialStyle,
    placement: undefined,
    arrowStyle: initialArrowStyle,
    outOfBoundaries: undefined,
  };

  popperInstance: ?Instance;

  popperNode: ?HTMLElement = null;
  arrowNode: ?HTMLElement = null;

  setPopperNode = (popperNode: ?HTMLElement) => {
    if (!popperNode || this.popperNode === popperNode) return;

    setRef(this.props.innerRef, popperNode);
    this.popperNode = popperNode;

    this.updatePopperInstance();
  };

  setArrowNode = (arrowNode: ?HTMLElement) => {
    this.arrowNode = arrowNode;
  };

  updateStateModifier = {
    enabled: true,
    order: 900,
    fn: (data: Data) => {
      const newState = {
        style: {
          position: data.offsets.popper.position,
          ...data.styles,
        },
        placement: data.placement,
        arrowStyle: data.arrowStyles,
        outOfBoundaries: data.hide,
      };

      // only re-render if something has changed
      if (!deepEqual(this.state, newState))
        this.setState(newState);

      return data;
    },
  };

  getOptions = () => ({
    placement: this.props.placement,
    eventsEnabled: this.props.eventsEnabled,
    positionFixed: this.props.positionFixed,
    modifiers: {
      ...this.props.modifiers,
      arrow: {
        ...(this.props.modifiers && this.props.modifiers.arrow),
        enabled: !!this.arrowNode,
        element: this.arrowNode,
      },
      applyStyle: { enabled: false },
      updateStateModifier: this.updateStateModifier,
    },
  });

  destroyPopperInstance = () => {
    if (!this.popperInstance) return;

    this.popperInstance.destroy();
    this.popperInstance = null;
  };

  updatePopperInstance = () => {
    this.destroyPopperInstance();

    const { popperNode } = this;
    const { referenceElement } = this.props;

    if (!referenceElement || !popperNode) return;

    this.popperInstance = new PopperJS(
      referenceElement,
      popperNode,
      this.getOptions()
    );
  };

  scheduleUpdate = () => {
    if (this.popperInstance) {
      this.popperInstance.scheduleUpdate();
    }
  };

  componentDidUpdate(prevProps: PopperProps) {
    // If the Popper.js options have changed, update the instance (destroy + create)
    if (
      this.props.placement !== prevProps.placement ||
      this.props.referenceElement !== prevProps.referenceElement ||
      this.props.positionFixed !== prevProps.positionFixed ||
      !deepEqual(this.props.modifiers, prevProps.modifiers, {strict: true})
    ) {

      // develop only check that modifiers isn't being updated needlessly
      if (process.env.NODE_ENV === "development") {
        if (
          this.props.modifiers !== prevProps.modifiers &&
          this.props.modifiers != null &&
          prevProps.modifiers != null &&
          shallowEqual(this.props.modifiers, prevProps.modifiers)
        ) {
          console.warn("'modifiers' prop reference updated even though all values appear the same.\nConsider memoizing the 'modifiers' object to avoid needless rendering.");
        }
      }

      this.updatePopperInstance();
      return;
    }

    if (
      this.props.eventsEnabled !== prevProps.eventsEnabled &&
      this.popperInstance
    ) {
      this.props.eventsEnabled
        ? this.popperInstance.enableEventListeners()
        : this.popperInstance.disableEventListeners();
    }

    this.scheduleUpdate();
  }

  componentWillUnmount() {
    setRef(this.props.innerRef, null)
    this.destroyPopperInstance();
  }

  render() {
    return unwrapArray(this.props.children)({
      ref: this.setPopperNode,
      style: this.state.style,
      placement: this.state.placement,
      outOfBoundaries: this.state.outOfBoundaries,
      scheduleUpdate: this.scheduleUpdate,
      arrowProps: {
        ref: this.setArrowNode,
        style: this.state.arrowStyle,
      },
    });
  }
}

const placements = PopperJS.placements;
export { placements };

export default function Popper({ referenceElement, ...props }: PopperProps) {
  return (
    <ManagerReferenceNodeContext.Consumer>
      {(referenceNode) => (
        <InnerPopper
          referenceElement={
            referenceElement !== undefined ? referenceElement : referenceNode
          }
          {...props}
        />
      )}
    </ManagerReferenceNodeContext.Consumer>
  );
}
