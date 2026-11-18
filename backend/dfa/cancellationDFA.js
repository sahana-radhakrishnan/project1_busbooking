
const cancellationTransitions = {
    START: {
        IDENTIFY_BOOKING: "BOOKING_IDENTIFIED"
    },
    BOOKING_IDENTIFIED: {
        REQUEST_CANCELLATION: "CANCELLATION_REQUESTED"
    },
    CANCELLATION_REQUESTED: {
        VALIDATE_CANCELLATION: "CANCELLATION_VALIDATED"
    },
    CANCELLATION_VALIDATED: {
        CONFIRM_CANCELLATION: "CANCELLATION_CONFIRMED"
    }
};

function runCancellationDFA(events) {
    let currentState = "START";
    const stateHistory = [currentState];

    for (const event of events) {
        const nextState = cancellationTransitions[currentState]?.[event];

        if (!nextState) {
            return {
                accepted: false,
                currentState: "REJECTED",
                stateHistory: [...stateHistory, "REJECTED"]
            };
        }

        currentState = nextState;
        stateHistory.push(currentState);
    }

    return {
        accepted: currentState === "CANCELLATION_CONFIRMED",
        currentState,
        stateHistory
    };
}

module.exports = { runCancellationDFA };
