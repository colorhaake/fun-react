import {Subject} from 'rx'
import {id} from './util'

export const mapEvent = (React, Cycle) => {
  const Mapper = Cycle.component('Mapper', (interactions, props) => {
    const mapFn$ = props.get('mapFn')
    const event$ = interactions.get('on_event')
    .withLatestFrom(mapFn$, (evt, mapFn) => mapFn(evt))

    return {
      view: props.get('element').map(element => (
        React.cloneElement(element, {
          onEvent: interactions.listener('on_event')
        })
      )),
      events: {
        onEvent: event$
      }
    }
  })

  return (mapFn, element) => {
    return React.createElement(Mapper, {
      key: element.key,
      mapFn,
      element
    })
  }
}

export const component =
  (React, Cycle) => (componentName, defFn, componentOptions) =>
{
  // binding context
  const map = mapEvent(React, Cycle)

  const cycleDefFn = (interactions, props, self, lifecycles) => {
    // event system
    const event$ = new Subject()
    const sendEvent = event => {
      event$.onNext(event)
    }

    // register function
    const event = (type, transform = id) => {
      return evt => sendEvent(type(transform(evt)))
    }

    // link
    const linkEvent = element => {
      return React.cloneElement(element, {
        onEvent: sendEvent
      })
    }

    // map and link
    const mapAndLinkEvent = (mapFn, element) => {
      return linkEvent(
        map(mapFn, element)
      )
    }

    // binding API
    linkEvent.map = mapAndLinkEvent

    const fun = {
      event,
      link: linkEvent,
      map,
      interactions, // cycle compatible
    }

    const cycleDef = defFn(fun, props, self, lifecycles)
    const {view, events: cycleEvents} = cycleDef.view
      ? cycleDef
      : {view: cycleDef, events: {}}

    // dispatch cycle events
    Object.keys(cycleEvents).forEach(type => {
      const obs$ = cycleEvents[type]
      obs$.subscribe(payload => {
        sendEvent({type, payload})
      })
    })

    // TODO write test
    const dispatchToOrdinaryReactInterface = evt => {
      const cb = self.props[evt.type]
      if (cb) {
        cb(evt.payload)
      }
    }

    return {
      view,
      events: {
        onEvent: event$.doOnNext(dispatchToOrdinaryReactInterface)
      }
    }
  }

  return Cycle.component(componentName, cycleDefFn, componentOptions)
}
