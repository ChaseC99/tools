<script>
    let feet;
    let inches;
    let weight;

    $: height = feet * 12 + inches;
    $: infoInputted = !!height && !!weight;
    $: bmi = (weight / (height * height)) * 703;

    $: isUnderweight = bmi < 18.5 && infoInputted;
    $: isNormalWeight = 18.5 <= bmi && bmi < 25 && infoInputted;
    $: isOverweight = 25 <= bmi && bmi < 30 && infoInputted;
    $: isObese = bmi >= 30 && infoInputted;

    function selectText(event) {
        event.target.select();
    }
</script>

<section class="bmi-calculator ui-stack" data-gap="lg" aria-label="BMI calculator">
    <div class="ui-panel bmi-inputs">
        <div class="ui-field">
            <span class="ui-label">Height</span>
            <div class="height-inputs">
                <label class="ui-sr-only" for="feet">Height in feet</label>
                <input
                    class="ui-input measurement-input"
                    type="number"
                    id="feet"
                    placeholder="ft"
                    min="0"
                    bind:value={feet}
                    on:focus={selectText}
                />

                <label class="ui-sr-only" for="inches">Additional height in inches</label>
                <input
                    class="ui-input measurement-input"
                    type="number"
                    id="inches"
                    placeholder="in"
                    min="0"
                    max="11"
                    bind:value={inches}
                    on:focus={selectText}
                />
            </div>
        </div>

        <label class="ui-field" for="weight">
            <span class="ui-label">Weight</span>
            <input
                class="ui-input measurement-input"
                type="number"
                id="weight"
                placeholder="lbs"
                min="0"
                bind:value={weight}
                on:focus={selectText}
            />
        </label>

        <div class="ui-result-card bmi-result" aria-live="polite">
            <span class="ui-stat-label">Your BMI</span>
            <strong class="bmi-value">{infoInputted ? bmi.toFixed(2) : "—"}</strong>
            <span class="ui-muted">US customary units</span>
        </div>
    </div>

    <section class="ui-panel ui-stack" aria-labelledby="bmi-ranges-title">
        <div class="ui-section-header">
            <h2 id="bmi-ranges-title">BMI ranges</h2>
            <span class="ui-muted">For adults</span>
        </div>

        <div class="bmi-ranges">
            <div class:active={isUnderweight} class="bmi-range bmi-range--warning">
                <strong>Underweight</strong>
                <span>&lt; 18.5</span>
            </div>
            <div class:active={isNormalWeight} class="bmi-range bmi-range--success">
                <strong>Normal weight</strong>
                <span>18.5–24.9</span>
            </div>
            <div class:active={isOverweight} class="bmi-range bmi-range--warning">
                <strong>Overweight</strong>
                <span>25–29.9</span>
            </div>
            <div class:active={isObese} class="bmi-range bmi-range--danger">
                <strong>Obesity</strong>
                <span>30+</span>
            </div>
        </div>
    </section>
</section>

<style>
    .bmi-inputs {
        display: grid;
        grid-template-columns: 1fr 1fr minmax(150px, 0.8fr);
        align-items: end;
        gap: var(--ui-space-5);
    }

    .height-inputs {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--ui-space-2);
    }

    .measurement-input {
        min-width: 0;
        font-size: var(--ui-font-size-lg);
        font-variant-numeric: tabular-nums;
    }

    .measurement-input::-webkit-outer-spin-button,
    .measurement-input::-webkit-inner-spin-button {
        margin: 0;
        -webkit-appearance: none;
    }

    .measurement-input[type="number"] {
        appearance: textfield;
    }

    .bmi-result {
        min-height: 7rem;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        padding: var(--ui-space-4);
        background: var(--ui-color-surface-inset);
        text-align: center;
    }

    .bmi-value {
        display: block;
        font-size: var(--ui-font-size-2xl);
        font-variant-numeric: tabular-nums;
        line-height: 1.15;
    }

    .bmi-ranges {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: var(--ui-space-2);
    }

    .bmi-range {
        min-width: 0;
        display: grid;
        gap: var(--ui-space-1);
        padding: var(--ui-space-3);
        border: 1px solid var(--ui-color-border);
        border-radius: var(--ui-radius-md);
        background: var(--ui-color-surface-inset);
        color: var(--ui-color-text-muted);
        font-size: var(--ui-font-size-sm);
        transition: border-color var(--ui-motion-base) var(--ui-ease-standard), background var(--ui-motion-base) var(--ui-ease-standard), color var(--ui-motion-base) var(--ui-ease-standard);
    }

    .bmi-range span {
        font-variant-numeric: tabular-nums;
    }

    .bmi-range.active {
        box-shadow: inset 0 0 0 1px currentColor;
    }

    .bmi-range--success.active {
        border-color: var(--ui-color-success-border);
        background: var(--ui-color-success-surface);
        color: var(--ui-color-success);
    }

    .bmi-range--warning.active {
        border-color: var(--ui-color-warning-border);
        background: var(--ui-color-warning-surface);
        color: var(--ui-color-warning);
    }

    .bmi-range--danger.active {
        border-color: var(--ui-color-danger-border);
        background: var(--ui-color-danger-surface);
        color: var(--ui-color-danger);
    }

    @media (max-width: 680px) {
        .bmi-inputs {
            grid-template-columns: 1fr 1fr;
        }

        .bmi-result {
            grid-column: 1 / -1;
        }

        .bmi-ranges {
            grid-template-columns: 1fr 1fr;
        }
    }

    @media (max-width: 420px) {
        .bmi-inputs,
        .bmi-ranges {
            grid-template-columns: 1fr;
        }

        .bmi-result {
            grid-column: auto;
        }
    }
</style>
