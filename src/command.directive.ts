import {
	Directive,
	OnInit,
	OnDestroy,
	Input,
	HostBinding,
	HostListener,
	ElementRef,
	Inject,
	Renderer2,
	ChangeDetectorRef,
	ViewContainerRef,
} from "@angular/core";
import { Subscription, Observable, EMPTY } from "rxjs";
import { tap, merge } from "rxjs/operators";

import { CommandOptions, COMMAND_CONFIG, COMMAND_DEFAULT_CONFIG } from "./config";
import { Command } from "./command";
import { isCommand, isCommandArg } from "./command.util";
import { CommandDirectiveArg, ICommand } from "./command.model";

/**
 * Controls the state of a component in sync with `Command`.
 *
 * ### Most common usage
 * ```html
 * <button [command]="saveCmd">Save</button>
 * ```
 *
 *
 * ### Usage with options
 * ```html
 * <button [command]="saveCmd" [commandOptions]="{executingCssClass: 'in-progress'}">Save</button>
 * ```
 *
 *
 * ### Usage with params
 * This is useful for collections (loops) or using multiple actions with different args.
 * *NOTE: This will share the `isExecuting` when used with multiple controls.*
 *
 * #### With single param
 *
 * ```html
 * <button [command]="saveCmd" [commandParams]="{id: 1}">Save</button>
 * ```
 *
 *
  * #### With multi params
 * ```html
 * <button [command]="saveCmd" [commandParams]="[{id: 1}, "hello", hero]">Save</button>
 * ```
 *
 * ### Usage with Command Directive Args
 * This is useful for collections (loops) or using multiple actions with different args, whilst not sharing `isExecuting`.
 *
 *
 * ```html
 * <button [command]="{execute: removeHero$, canExecute: isValid$, params: [hero, 1337, 'xx']}">Save</button>
 * ```
 *
 */
@Directive({
	selector: "[command]",
})
export class CommandDirective implements OnInit, OnDestroy {
	@Input("command") commandInput!: ICommand | CommandDirectiveArg | undefined;
	@Input() commandOptions!: CommandOptions;
	@Input() commandParams: any;
	@HostBinding("disabled") isDisabled: boolean | undefined;

	Command: Readonly<ICommand>;
	private data$$!: Subscription;

	constructor(
		@Inject(COMMAND_CONFIG) private config: CommandOptions,
		private renderer: Renderer2,
		private element: ElementRef,
		private cdr: ChangeDetectorRef,
		private viewContainer: ViewContainerRef
	) { }

	ngOnInit() {
		// console.log("[commandDirective::init]");
		this.commandOptions = {
			...COMMAND_DEFAULT_CONFIG,
			...this.config,
			...this.commandOptions,
		};

		if (!this.commandInput) {
			throw new Error("[commandDirective] [command] should be defined!");
		} else if (isCommand(this.commandInput)) {
			this.Command = this.commandInput;
		} else if (isCommandArg(this.commandInput)) {
			const isAsync = this.commandInput.isAsync || this.commandInput.isAsync === undefined;
			const hostComponent = (this.viewContainer as any)._view.component;

			const execFn = this.commandInput.execute.bind(hostComponent);
			this.commandParams = this.commandParams || this.commandInput.params;
			this.Command = new Command(execFn, this.commandInput.canExecute, isAsync);
		} else {
			throw new Error("[commandDirective] [command] is not defined properly!");
		}

		const canExecute$ = this.Command.canExecute$.pipe(
			tap(x => {
				// console.log("[commandDirective::canExecute$]", x);
				this.isDisabled = !x;
				this.cdr.markForCheck();
			})
		);

		let isExecuting$: Observable<boolean>;
		if (this.Command.isExecuting$) {
			isExecuting$ = this.Command.isExecuting$.pipe(
				tap(x => {
					// console.log("[commandDirective::isExecuting$]", x);
					if (x) {
						this.renderer.addClass(
							this.element.nativeElement,
							this.commandOptions.executingCssClass
						);
					} else {
						this.renderer.removeClass(
							this.element.nativeElement,
							this.commandOptions.executingCssClass
						);
					}
				})
			);
		} else {
			isExecuting$ = EMPTY;
		}
		this.data$$ = canExecute$.pipe(merge(isExecuting$)).subscribe();
	}

	@HostListener("click")
	onClick() {
		// console.log("[commandDirective::onClick]");
		this.Command.execute(this.commandParams);
	}

	ngOnDestroy() {
		// console.log("[commandDirective::destroy]");
		this.Command.destroy();
		this.data$$.unsubscribe();
	}
}