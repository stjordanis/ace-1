/*
 * @adonisjs/ace
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import test from 'japa'
import 'reflect-metadata'
import { join } from 'path'

import { Kernel } from '../src/Kernel'
import { args } from '../src/Decorators/args'
import { flags } from '../src/Decorators/flags'
import { BaseCommand } from '../src/BaseCommand'
import { Application } from '@adonisjs/application'
import { ManifestLoader } from '../src/Manifest/Loader'
import { setupApp, fs, info } from '../test-helpers'

test.group('Kernel | register', () => {
	test('raise error when required argument comes after optional argument', (assert) => {
		class Greet extends BaseCommand {
			public static commandName = 'greet'

			@args.string({ required: false })
			public name: string

			@args.string()
			public age: string

			public async run() {}
		}

		const app = setupApp()
		const kernel = new Kernel(app)
		const fn = () => kernel.register([Greet])
		assert.throw(fn, 'Optional argument "name" must be after the required argument "age"')
	})

	test('raise error when command name is missing', (assert) => {
		class Greet extends BaseCommand {
			public async run() {}
		}

		const app = setupApp()
		const kernel = new Kernel(app)
		const fn = () => kernel.register([Greet])
		assert.throw(
			fn,
			'Invalid command "Greet". Make sure to define the static property "commandName"'
		)
	})

	test("raise error when spread argument isn't the last one", (assert) => {
		class Greet extends BaseCommand {
			public static commandName = 'greet'

			@args.spread()
			public files: string[]

			@args.string()
			public name: string

			public async run() {}
		}

		const app = setupApp()
		const kernel = new Kernel(app)
		const fn = () => kernel.register([Greet])
		assert.throw(fn, 'Spread argument "files" must be at last position')
	})

	test('register command', (assert) => {
		const app = setupApp()
		const kernel = new Kernel(app)

		class Install extends BaseCommand {
			public static commandName = 'install'
			public async run() {}
		}

		class Greet extends BaseCommand {
			public static commandName = 'greet'
			public async run() {}
		}

		kernel.register([Install, Greet])
		assert.deepEqual(kernel.commands, { install: Install, greet: Greet })
	})

	test('return command name suggestions for a given string', (assert) => {
		const app = setupApp()
		const kernel = new Kernel(app)

		class Install extends BaseCommand {
			public static commandName = 'install'
			public async run() {}
		}

		class Greet extends BaseCommand {
			public static commandName = 'greet'
			public async run() {}
		}

		kernel.register([Install, Greet])
		assert.deepEqual(
			kernel.getSuggestions('itall').map(({ commandName }) => commandName),
			['install']
		)
	})

	test('return command name suggestions from manifest file', async (assert) => {
		const app = setupApp()
		const kernel = new Kernel(app)

		const manifestLoader = new ManifestLoader([
			{
				basePath: fs.basePath,
				manifestAbsPath: join(fs.basePath, 'ace-manifest.json'),
			},
		])

		await fs.add(
			'ace-manifest.json',
			JSON.stringify({
				greet: {
					commandName: 'greet',
					commandPath: './Commands/Greet.ts',
				},
			})
		)

		await fs.add(
			'Commands/Greet.ts',
			`export default class Greet {
      public static commandName = 'greet'
      public static boot () {}
    }`
		)

		kernel.useManifest(manifestLoader)
		await kernel.preloadManifest()

		assert.deepEqual(
			kernel.getSuggestions('eet').map(({ commandName }) => commandName),
			['greet']
		)

		await fs.cleanup()
	})

	test('change camelCase alias name to dashcase', (assert) => {
		class Greet extends BaseCommand {
			public static commandName = 'greet'

			@flags.boolean()
			public isAdmin: boolean

			public async run() {}
		}

		assert.deepEqual(Greet.flags[0].name, 'is-admin')
	})
})

test.group('Kernel | find', () => {
	test('find relevant command from the commands list', async (assert) => {
		class Greet extends BaseCommand {
			public static commandName = 'greet'
			public async run() {}
		}

		const app = setupApp()
		const kernel = new Kernel(app)
		kernel.register([Greet])

		const greet = await kernel.find(['greet'])
		assert.deepEqual(greet, Greet)
	})

	test('return null when unable to find command', async (assert) => {
		const app = setupApp()
		const kernel = new Kernel(app)
		const greet = await kernel.find(['greet'])

		assert.isNull(greet)
	})

	test('find command from manifest when manifestCommands exists', async (assert) => {
		const app = setupApp()
		const kernel = new Kernel(app)
		const manifestLoader = new ManifestLoader([
			{
				basePath: fs.basePath,
				manifestAbsPath: join(fs.basePath, 'ace-manifest.json'),
			},
		])

		await fs.add(
			'ace-manifest.json',
			JSON.stringify({
				greet: {
					commandName: 'greet',
					commandPath: './Commands/Greet.ts',
				},
			})
		)

		await fs.add(
			'Commands/Greet.ts',
			`export default class Greet {
			public static commandName = 'greet'
			public static args = []
			public static flags = []
			public static boot() {}
    }`
		)

		kernel.useManifest(manifestLoader)
		await kernel.preloadManifest()

		const greet = await kernel.find(['greet'])
		assert.equal(greet!.name, 'Greet')

		await fs.cleanup()
	})

	test('register commands along with manifest', async (assert) => {
		const app = setupApp()
		const kernel = new Kernel(app)
		const manifestLoader = new ManifestLoader([
			{
				basePath: fs.basePath,
				manifestAbsPath: join(fs.basePath, 'ace-manifest.json'),
			},
		])

		await fs.add(
			'ace-manifest.json',
			JSON.stringify({
				greet: {
					commandName: 'greet',
					commandPath: './Commands/Greet.ts',
				},
			})
		)

		await fs.add(
			'Commands/Greet.ts',
			`export default class Greet {
      public static commandName = 'greet'
			public static args = []
			public static flags = []
			public static boot() {}
    }`
		)

		kernel.useManifest(manifestLoader)
		await kernel.preloadManifest()

		kernel.register([
			class Help extends BaseCommand {
				public static commandName = 'help'
				public async run() {}
			},
		])

		const greet = await kernel.find(['greet'])
		assert.equal(greet!.commandName, 'greet')

		const help = await kernel.find(['help'])
		assert.equal(help!.commandName, 'help')

		await fs.cleanup()
	})

	test('execute before and after hook when finding command from manifest', async (assert) => {
		assert.plan(3)

		const app = setupApp()
		const kernel = new Kernel(app)
		const manifestLoader = new ManifestLoader([
			{
				basePath: fs.basePath,
				manifestAbsPath: join(fs.basePath, 'ace-manifest.json'),
			},
		])

		await fs.add(
			'ace-manifest.json',
			JSON.stringify({
				greet: {
					commandName: 'greet',
					commandPath: './Commands/Greet.ts',
				},
			})
		)

		await fs.add(
			'Commands/Greet.ts',
			`export default class Greet {
      public static commandName = 'greet'
			public static args = []
			public static flags = []
			public static boot() {}
    }`
		)

		kernel.useManifest(manifestLoader)

		kernel.before('find', (command) => {
			assert.equal(command!.commandName, 'greet')
		})

		kernel.after('find', (command) => {
			assert.equal(command!.commandName, 'greet')
			assert.equal(command!['name'], 'Greet') // It is command constructor
		})

		await kernel.preloadManifest()
		await kernel.find(['greet'])
		await fs.cleanup()
	})

	test('pass null to before and after hook when unable to find command', async (assert) => {
		assert.plan(3)

		const app = setupApp()
		const kernel = new Kernel(app)
		kernel.before('find', (command) => assert.isNull(command))
		kernel.after('find', (command) => assert.isNull(command))

		const greet = await kernel.find(['greet'])

		assert.isNull(greet)
	})

	test('pass command constructor to before and after hook found command from local commands', async (assert) => {
		assert.plan(3)
		class Greet extends BaseCommand {
			public static commandName = 'greet'
			public async run() {}
		}

		const app = setupApp()
		const kernel = new Kernel(app)
		kernel.register([Greet])

		kernel.before('find', (command) => assert.deepEqual(command, Greet))
		kernel.after('find', (command) => assert.deepEqual(command, Greet))

		const greet = await kernel.find(['greet'])
		assert.deepEqual(greet, Greet)
	})
})

test.group('Kernel | exec', () => {
	test('raise exception when required argument is missing', async (assert) => {
		assert.plan(3)

		class Greet extends BaseCommand {
			public static commandName = 'greet'

			@args.string()
			public name: string

			public async run() {}
		}

		const app = setupApp()
		const kernel = new Kernel(app)
		kernel.register([Greet])

		const argv = ['greet']
		try {
			await kernel.handle(argv)
		} catch ({ message, argumentName, command }) {
			assert.equal(message, 'E_MISSING_ARGUMENT: Missing required argument "name"')
			assert.equal(argumentName, 'name')
			assert.deepEqual(command, Greet)
		}
	})

	test('work fine when argument is missing and is optional', async (assert) => {
		assert.plan(1)

		class Greet extends BaseCommand {
			public static commandName = 'greet'

			@args.string({ required: false })
			public name: string

			public async run() {
				assert.deepEqual(this.parsed, { _: [] })
			}
		}

		const app = setupApp()
		const kernel = new Kernel(app)
		kernel.register([Greet])

		const argv = ['greet']
		await kernel.handle(argv)
	})

	test('work fine when required argument is defined', async (assert) => {
		assert.plan(2)

		class Greet extends BaseCommand {
			public static commandName = 'greet'

			@args.string()
			public name: string

			public async run() {
				assert.deepEqual(this.parsed, { _: ['virk'] })
				assert.equal(this.name, 'virk')
			}
		}

		const app = setupApp()
		const kernel = new Kernel(app)
		kernel.register([Greet])

		const argv = ['greet', 'virk']
		await kernel.handle(argv)
	})

	test('define spread arguments', async (assert) => {
		assert.plan(2)

		class Greet extends BaseCommand {
			public static commandName = 'greet'

			@args.spread()
			public files: string[]

			public async run() {
				assert.deepEqual(this.parsed, { _: ['foo.js', 'bar.js'] })
				assert.deepEqual(this.files, ['foo.js', 'bar.js'])
			}
		}

		const app = setupApp()
		const kernel = new Kernel(app)
		kernel.register([Greet])

		const argv = ['greet', 'foo.js', 'bar.js']
		await kernel.handle(argv)
	})

	test('define spread arguments with regular arguments', async (assert) => {
		assert.plan(4)

		class Greet extends BaseCommand {
			public static commandName = 'greet'

			@args.string()
			public name: string

			@args.string()
			public age: string

			@args.spread()
			public files: string[]

			public async run() {
				assert.deepEqual(this.parsed, { _: ['virk', '22', 'foo.js', 'bar.js'] })
				assert.equal(this.name, 'virk')
				assert.equal(this.age, '22')
				assert.deepEqual(this.files, ['foo.js', 'bar.js'])
			}
		}

		const app = setupApp()
		const kernel = new Kernel(app)
		kernel.register([Greet])

		const argv = ['greet', 'virk', '22', 'foo.js', 'bar.js']
		await kernel.handle(argv)
	})

	test('set arguments and flags', async (assert) => {
		assert.plan(3)

		class Greet extends BaseCommand {
			public static commandName = 'greet'

			@args.string()
			public name: string

			@flags.boolean()
			public admin: boolean

			public async run() {
				assert.deepEqual(this.parsed, { _: ['virk'], admin: true })
				assert.equal(this.name, 'virk')
				assert.isTrue(this.admin)
			}
		}

		const app = setupApp()
		const kernel = new Kernel(app)
		kernel.register([Greet])

		const argv = ['greet', 'virk', '--admin']
		await kernel.handle(argv)
	})

	test('set arguments and flags when flag is defined with = sign', async (assert) => {
		assert.plan(3)

		class Greet extends BaseCommand {
			public static commandName = 'greet'

			@args.string()
			public name: string

			@flags.boolean()
			public admin: boolean

			public async run() {
				assert.deepEqual(this.parsed, { _: ['virk'], admin: true })
				assert.equal(this.name, 'virk')
				assert.isTrue(this.admin)
			}
		}

		const app = setupApp()
		const kernel = new Kernel(app)
		kernel.register([Greet])

		const argv = ['greet', 'virk', '--admin=true']
		await kernel.handle(argv)
	})

	test('set arguments and flags when flag alias is passed', async (assert) => {
		assert.plan(3)

		class Greet extends BaseCommand {
			public static commandName = 'greet'

			@args.string()
			public name: string

			@flags.boolean({ alias: 'a' })
			public admin: boolean

			public async run() {
				assert.deepEqual(this.parsed, { _: ['virk'], admin: true, a: true })
				assert.equal(this.name, 'virk')
				assert.isTrue(this.admin)
			}
		}

		const app = setupApp()
		const kernel = new Kernel(app)
		kernel.register([Greet])

		const argv = ['greet', 'virk', '-a']
		await kernel.handle(argv)
	})

	test("set flag when it's name is different from command property", async (assert) => {
		assert.plan(3)

		class Greet extends BaseCommand {
			public static commandName = 'greet'

			@args.string()
			public name: string

			@flags.boolean({ name: 'admin', alias: 'a' })
			public isAdmin: boolean

			public async run() {
				assert.deepEqual(this.parsed, { _: ['virk'], admin: true, a: true })
				assert.equal(this.name, 'virk')
				assert.isTrue(this.isAdmin)
			}
		}

		const app = setupApp()
		const kernel = new Kernel(app)
		kernel.register([Greet])

		const argv = ['greet', 'virk', '-a']
		await kernel.handle(argv)
	})

	test('parse boolean flags as boolean always', async (assert) => {
		assert.plan(3)

		class Greet extends BaseCommand {
			public static commandName = 'greet'

			@args.string()
			public name: string

			@flags.boolean()
			public admin: boolean

			public async run() {
				assert.deepEqual(this.parsed, { _: ['virk'], admin: true })
				assert.equal(this.name, 'virk')
				assert.isTrue(this.admin)
			}
		}

		const app = setupApp()
		const kernel = new Kernel(app)
		kernel.register([Greet])

		const argv = ['greet', 'virk', '--admin=true']
		await kernel.handle(argv)
	})

	test('parse boolean flags as boolean always also when aliases are defined', async (assert) => {
		assert.plan(3)

		class Greet extends BaseCommand {
			public static commandName = 'greet'

			@args.string()
			public name: string

			@flags.boolean({ alias: 'a' })
			public admin: boolean

			public async run() {
				assert.deepEqual(this.parsed, { _: ['virk'], admin: true, a: true })
				assert.equal(this.name, 'virk')
				assert.isTrue(this.admin)
			}
		}

		const app = setupApp()
		const kernel = new Kernel(app)
		kernel.register([Greet])

		const argv = ['greet', 'virk', '-a=true']
		await kernel.handle(argv)
	})

	test('do not override default value when flag is not defined', async (assert) => {
		assert.plan(3)

		class Greet extends BaseCommand {
			public static commandName = 'greet'

			@args.string()
			public name: string

			@flags.boolean({ default: true, alias: 'a' })
			public admin: boolean

			public async run() {
				assert.deepEqual(this.parsed, { _: ['virk'], admin: true, a: true })
				assert.equal(this.name, 'virk')
				assert.isTrue(this.admin)
			}
		}

		const app = setupApp()
		const kernel = new Kernel(app)
		kernel.register([Greet])

		const argv = ['greet', 'virk']
		await kernel.handle(argv)
	})

	test('do not overwrite default value defined on the instance property', async (assert) => {
		assert.plan(3)

		class Greet extends BaseCommand {
			public static commandName = 'greet'

			@args.string()
			public name: string

			@flags.string()
			public connection: string = 'foo'

			public async run() {
				assert.deepEqual(this.parsed, { _: ['virk'], connection: '' })
				assert.equal(this.name, 'virk')
				assert.equal(this.connection, 'foo')
			}
		}

		const app = setupApp()
		const kernel = new Kernel(app)
		kernel.register([Greet])

		const argv = ['greet', 'virk']
		await kernel.handle(argv)
	})

	test('define default value via decorator', async (assert) => {
		assert.plan(3)

		class Greet extends BaseCommand {
			public static commandName = 'greet'

			@args.string()
			public name: string

			@flags.string({
				async defaultValue() {
					return 'foo'
				},
			})
			public connection: string

			public async run() {
				assert.deepEqual(this.parsed, { _: ['virk'], connection: '' })
				assert.equal(this.name, 'virk')
				assert.equal(this.connection, 'foo')
			}
		}

		const app = setupApp()
		const kernel = new Kernel(app)
		kernel.register([Greet])

		const argv = ['greet', 'virk']
		await kernel.handle(argv)
	})

	test('parse flags as array when type is set to array', async (assert) => {
		assert.plan(3)

		class Greet extends BaseCommand {
			public static commandName = 'greet'

			@args.string()
			public name: string

			@flags.array()
			public files: string[]

			public async run() {
				assert.deepEqual(this.parsed, { _: ['virk'], files: ['foo.js'] })
				assert.equal(this.name, 'virk')
				assert.deepEqual(this.files, ['foo.js'])
			}
		}

		const app = setupApp()
		const kernel = new Kernel(app)
		kernel.register([Greet])

		const argv = ['greet', 'virk', '--files=foo.js']
		await kernel.handle(argv)
	})

	test('register global flags', async (assert) => {
		assert.plan(2)

		const app = setupApp()
		const kernel = new Kernel(app)
		kernel.flag(
			'env',
			(env, parsed) => {
				assert.equal(env, 'production')
				assert.deepEqual(parsed, { _: [], env: 'production' })
			},
			{ type: 'string' }
		)

		const argv = ['--env=production']
		await kernel.handle(argv)
	})

	test('register global boolean flags', async (assert) => {
		assert.plan(2)

		const app = setupApp()
		const kernel = new Kernel(app)
		kernel.flag(
			'ansi',
			(ansi, parsed) => {
				assert.equal(ansi, true)
				assert.deepEqual(parsed, { _: [], ansi: true })
			},
			{}
		)

		const argv = ['--ansi']
		await kernel.handle(argv)
	})

	test('register global reverse boolean flags', async (assert) => {
		assert.plan(2)

		const app = setupApp()
		const kernel = new Kernel(app)
		kernel.flag(
			'ansi',
			(ansi, parsed) => {
				assert.equal(ansi, false)
				assert.deepEqual(parsed, { _: [], ansi: false })
			},
			{}
		)

		const argv = ['--no-ansi']
		await kernel.handle(argv)
	})

	test('do not execute string global flag when flag is not defined', async () => {
		const app = setupApp()
		const kernel = new Kernel(app)
		kernel.flag(
			'env',
			() => {
				throw new Error('Not expected to be called')
			},
			{ type: 'string' }
		)

		const argv = ['--ansi']
		await kernel.handle(argv)
	})

	test('do not execute array global flag when flag is not defined', async () => {
		const app = setupApp()
		const kernel = new Kernel(app)
		kernel.flag(
			'env',
			() => {
				throw new Error('Not expected to be called')
			},
			{ type: 'array' }
		)

		const argv = ['--ansi']
		await kernel.handle(argv)
	})

	test('do not execute num array type global flag when flag is not defined', async () => {
		const app = setupApp()
		const kernel = new Kernel(app)
		kernel.flag(
			'env',
			() => {
				throw new Error('Not expected to be called')
			},
			{ type: 'numArray' }
		)

		const argv = ['--ansi']
		await kernel.handle(argv)
	})

	test('pass command instance to the global flag, when flag is defined on a command', async (assert) => {
		assert.plan(3)
		const app = setupApp()
		const kernel = new Kernel(app)

		class Greet extends BaseCommand {
			public static commandName = 'greet'

			@args.string()
			public name: string

			public async run() {}
		}

		kernel.register([Greet])

		kernel.flag(
			'env',
			(env, parsed, command) => {
				assert.equal(env, 'production')
				assert.deepEqual(parsed, { _: ['virk'], env: 'production' })
				assert.deepEqual(command, Greet)
			},
			{ type: 'string' }
		)

		const argv = ['greet', 'virk', '--env=production']
		await kernel.handle(argv)
	})

	test('define arg name different from property name', async (assert) => {
		assert.plan(2)

		class Greet extends BaseCommand {
			public static commandName = 'greet'

			@args.string({ name: 'theName' })
			public name: string

			public async run() {
				assert.deepEqual(this.parsed, { _: ['virk'] })
				assert.equal(this.name, 'virk')
			}
		}

		const app = setupApp()
		const kernel = new Kernel(app)
		kernel.register([Greet])

		const argv = ['greet', 'virk']
		await kernel.handle(argv)
	})

	test('define flag name different from property name', async (assert) => {
		assert.plan(2)

		class Greet extends BaseCommand {
			public static commandName = 'greet'

			@flags.boolean({ name: 'isAdmin' })
			public admin: boolean

			public async run() {
				assert.deepEqual(this.parsed, { _: [], isAdmin: true })
				assert.isTrue(this.admin)
			}
		}

		const app = setupApp()
		const kernel = new Kernel(app)
		kernel.register([Greet])

		const argv = ['greet', '--isAdmin']
		await kernel.handle(argv)
	})

	test('execute before and after run hooks', async (assert) => {
		assert.plan(2)

		class Greet extends BaseCommand {
			public static commandName = 'greet'

			@flags.boolean({ name: 'isAdmin' })
			public admin: boolean

			public async run() {}
		}

		const app = setupApp()
		const kernel = new Kernel(app)
		kernel.before('run', (command) => {
			assert.instanceOf(command, Greet)
		})

		kernel.after('run', (command) => {
			assert.instanceOf(command, Greet)
		})

		kernel.register([Greet])

		const argv = ['greet']
		await kernel.handle(argv)
	})

	test('execute before and after run hooks even when command raises an exception', async (assert) => {
		assert.plan(4)

		class Greet extends BaseCommand {
			public static commandName = 'greet'

			@flags.boolean({ name: 'isAdmin' })
			public admin: boolean

			public async run() {
				throw new Error('Boom')
			}
		}

		const app = setupApp()
		const kernel = new Kernel(app)
		kernel.before('run', (command) => {
			assert.instanceOf(command, Greet)
		})

		kernel.after('run', (command) => {
			assert.instanceOf(command, Greet)
			assert.equal(command.error!.message, 'Boom')
		})

		kernel.register([Greet])

		const argv = ['greet']
		try {
			await kernel.handle(argv)
		} catch (error) {
			assert.equal(error.message, 'Boom')
		}
	})
})

test.group('Kernel | runCommand', () => {
	test('test logs in test mode', async (assert) => {
		assert.plan(1)

		class Greet extends BaseCommand {
			public static commandName = 'greet'

			@args.string()
			public name: string

			public async run() {
				this.logger.info(`Hello ${this.name}`)
			}
		}

		const app = setupApp()
		const kernel = new Kernel(app)
		kernel.register([Greet])

		const argv = ['greet', 'virk']
		const command = await kernel.find(argv)
		const commandInstance = new command!(app, kernel)
		await kernel.runCommand(commandInstance, argv)

		assert.deepEqual(commandInstance.ui.testingRenderer.logs, [
			{
				message: `${info}  Hello virk`,
				stream: 'stdout',
			},
		])
	})

	test('test input prompt in raw mode', async (assert) => {
		assert.plan(1)

		class Greet extends BaseCommand {
			public static commandName = 'greet'

			@args.string()
			public name: string

			public async run() {
				const username = await this.prompt.ask("What's your username?", {
					name: 'username',
				})
				this.logger.info(username)
			}
		}

		const app = setupApp()

		const kernel = new Kernel(app)
		kernel.register([Greet])

		const argv = ['greet', 'virk']
		const command = await kernel.find(argv)
		const commandInstance = new command!(app, kernel)

		/**
		 * Responding to prompt programatically
		 */
		commandInstance.prompt.on('prompt', (prompt) => {
			prompt.answer('virk')
		})

		await kernel.runCommand(commandInstance, argv)
		assert.deepEqual(commandInstance.ui.testingRenderer.logs, [
			{
				message: `${info}  virk`,
				stream: 'stdout',
			},
		])
	})

	test('test input prompt validation in raw mode', async (assert) => {
		assert.plan(2)

		class Greet extends BaseCommand {
			public static commandName = 'greet'

			@args.string()
			public name: string

			public async run() {
				const username = await this.prompt.ask("What's your username?", {
					name: 'username',
					validate(value) {
						return !!value
					},
				})

				this.logger.info(username)
			}
		}

		const app = setupApp()

		const kernel = new Kernel(app)
		kernel.register([Greet])

		const argv = ['greet', 'virk']
		const command = await kernel.find(argv)
		const commandInstance = new command!(app, kernel)

		/**
		 * Responding to prompt programatically
		 */
		commandInstance.prompt.on('prompt', (prompt) => {
			prompt.answer('')
		})

		commandInstance.prompt.on('prompt:error', (message) => {
			assert.equal(message, 'Enter the value')
		})

		await kernel.runCommand(commandInstance, argv)
		assert.deepEqual(commandInstance.ui.testingRenderer.logs, [
			{
				message: `${info}  `,
				stream: 'stdout',
			},
		])
	})

	test('test choice prompt in raw mode', async (assert) => {
		assert.plan(1)

		class Greet extends BaseCommand {
			public static commandName = 'greet'

			@args.string()
			public name: string

			public async run() {
				const client = await this.prompt.choice('Select the installation client', ['npm', 'yarn'])
				this.logger.info(client)
			}
		}

		const app = setupApp()

		const kernel = new Kernel(app)
		kernel.register([Greet])

		const argv = ['greet', 'virk']
		const command = await kernel.find(argv)
		const commandInstance = new command!(app, kernel)

		/**
		 * Responding to prompt programatically
		 */
		commandInstance.prompt.on('prompt', (prompt) => {
			prompt.select(0)
		})

		await kernel.runCommand(commandInstance, argv)
		assert.deepEqual(commandInstance.ui.testingRenderer.logs, [
			{
				message: `${info}  npm`,
				stream: 'stdout',
			},
		])
	})

	test('test choice prompt validation in raw mode', async (assert) => {
		assert.plan(2)

		class Greet extends BaseCommand {
			public static commandName = 'greet'

			@args.string()
			public name: string

			public async run() {
				const client = await this.prompt.choice('Select the installation client', ['npm', 'yarn'], {
					validate(answer) {
						return !!answer
					},
				})
				this.logger.info(client)
			}
		}

		const app = setupApp()

		const kernel = new Kernel(app)
		kernel.register([Greet])

		const argv = ['greet', 'virk']
		const command = await kernel.find(argv)
		const commandInstance = new command!(app, kernel)

		/**
		 * Responding to prompt programatically
		 */
		commandInstance.prompt.on('prompt', (prompt) => {
			prompt.answer('')
		})

		commandInstance.prompt.on('prompt:error', (message) => {
			assert.equal(message, 'Enter the value')
		})

		await kernel.runCommand(commandInstance, argv)
		assert.deepEqual(commandInstance.ui.testingRenderer.logs, [
			{
				message: `${info}  `,
				stream: 'stdout',
			},
		])
	})

	test('test multiple prompt in raw mode', async (assert) => {
		assert.plan(1)
		process.env.CLI_UI_IS_TESTING = 'true'

		class Greet extends BaseCommand {
			public static commandName = 'greet'

			@args.string()
			public name: string

			public async run() {
				const clients = await this.prompt.multiple('Select the installation client', [
					'npm',
					'yarn',
				])
				this.logger.info(clients.join(','))
			}
		}

		const app = setupApp()

		const kernel = new Kernel(app)
		kernel.register([Greet])

		const argv = ['greet', 'virk']
		const command = await kernel.find(argv)
		const commandInstance = new command!(app, kernel)

		/**
		 * Responding to prompt programatically
		 */
		commandInstance.prompt.on('prompt', (prompt) => {
			prompt.select(0)
		})

		await kernel.runCommand(commandInstance, argv)
		assert.deepEqual(commandInstance.ui.testingRenderer.logs, [
			{
				message: `${info}  npm`,
				stream: 'stdout',
			},
		])
	})

	test('test multiple prompt validation in raw mode', async (assert) => {
		assert.plan(2)

		class Greet extends BaseCommand {
			public static commandName = 'greet'

			@args.string()
			public name: string

			public async run() {
				const client = await this.prompt.multiple(
					'Select the installation client',
					['npm', 'yarn'],
					{
						validate(answer) {
							return answer.length > 0
						},
					}
				)

				this.logger.info(client.join(','))
			}
		}

		const app = setupApp()

		const kernel = new Kernel(app)
		kernel.register([Greet])

		const argv = ['greet', 'virk']
		const command = await kernel.find(argv)
		const commandInstance = new command!(app, kernel)

		/**
		 * Responding to prompt programatically
		 */
		commandInstance.prompt.on('prompt', (prompt) => {
			prompt.answer([])
		})

		commandInstance.prompt.on('prompt:error', (message) => {
			assert.equal(message, 'Enter the value')
		})

		await kernel.runCommand(commandInstance, argv)
		assert.deepEqual(commandInstance.ui.testingRenderer.logs, [
			{
				message: `${info}  `,
				stream: 'stdout',
			},
		])
	})

	test('test toggle prompt in raw mode', async (assert) => {
		assert.plan(1)
		process.env.CLI_UI_IS_TESTING = 'true'

		class Greet extends BaseCommand {
			public static commandName = 'greet'

			@args.string()
			public name: string

			public async run() {
				const deleteFile = await this.prompt.toggle('Delete the file?', ['Yep', 'Nope'])
				this.logger.info(deleteFile ? 'Yep' : 'Nope')
			}
		}

		const app = setupApp()

		const kernel = new Kernel(app)
		kernel.register([Greet])

		const argv = ['greet', 'virk']
		const command = await kernel.find(argv)
		const commandInstance = new command!(app, kernel)

		/**
		 * Responding to prompt programatically
		 */
		commandInstance.prompt.on('prompt', (prompt) => {
			prompt.accept()
		})

		await kernel.runCommand(commandInstance, argv)
		assert.deepEqual(commandInstance.ui.testingRenderer.logs, [
			{
				message: `${info}  Yep`,
				stream: 'stdout',
			},
		])
	})

	test('exec command by name', async (assert) => {
		assert.plan(1)

		class Foo extends BaseCommand {
			public static commandName = 'foo'
			public async run() {
				assert.isTrue(true)
			}
		}

		const app = setupApp()
		const kernel = new Kernel(app)
		kernel.register([Foo])

		await kernel.exec('foo', [])
	})

	test('pass arguments and flags to command using exec', async (assert) => {
		assert.plan(2)

		class Foo extends BaseCommand {
			public static commandName = 'foo'

			@args.string()
			public name: string

			@flags.boolean()
			public isAdmin: boolean

			public async run() {
				assert.isTrue(this.isAdmin)
				assert.equal(this.name, 'virk')
			}
		}

		const app = setupApp()
		const kernel = new Kernel(app)
		kernel.register([Foo])

		await kernel.exec('foo', ['virk', '--is-admin=true'])
	})

	test('exec find and run hooks for the command using exec', async (assert) => {
		assert.plan(5)

		class Foo extends BaseCommand {
			public static commandName = 'foo'
			public async run() {
				assert.isTrue(true)
			}
		}

		const app = setupApp()
		const kernel = new Kernel(app)
		kernel.register([Foo])

		kernel.before('run', () => {
			assert.isTrue(true)
		})

		kernel.after('run', () => {
			assert.isTrue(true)
		})

		kernel.before('find', () => {
			assert.isTrue(true)
		})

		kernel.after('find', () => {
			assert.isTrue(true)
		})

		await kernel.exec('foo', [])
	})

	test('exec command prepare method', async (assert) => {
		assert.plan(2)

		class Foo extends BaseCommand {
			public static commandName = 'foo'
			public async prepare() {
				assert.isTrue(true)
			}

			public async run() {
				assert.isTrue(true)
			}
		}

		const app = setupApp()
		const kernel = new Kernel(app)
		kernel.register([Foo])
		await kernel.exec('foo', [])
	})

	test('exec command completed method', async (assert) => {
		assert.plan(2)

		class Foo extends BaseCommand {
			public static commandName = 'foo'
			public async completed() {
				assert.isUndefined(this.error)
			}

			public async run() {
				assert.isTrue(true)
			}
		}

		const app = setupApp()
		const kernel = new Kernel(app)
		kernel.register([Foo])
		await kernel.exec('foo', [])
	})

	test('exec command completed method, when command fails', async (assert) => {
		assert.plan(2)

		class Foo extends BaseCommand {
			public static commandName = 'foo'
			public async completed() {
				assert.equal(this.error!.message, 'Boom')
				return true
			}

			public async run() {
				assert.isTrue(true)
				throw new Error('Boom')
			}
		}

		const app = setupApp()
		const kernel = new Kernel(app)
		kernel.register([Foo])
		await kernel.exec('foo', [])
	})

	test("raise exception when completed method doesn't handle it", async (assert) => {
		assert.plan(3)

		class Foo extends BaseCommand {
			public static commandName = 'foo'
			public async completed() {
				assert.equal(this.error!.message, 'Boom')
			}

			public async run() {
				assert.isTrue(true)
				throw new Error('Boom')
			}
		}

		const app = setupApp()
		const kernel = new Kernel(app)
		kernel.register([Foo])
		try {
			await kernel.exec('foo', [])
		} catch (error) {
			assert.equal(error.message, 'Boom')
		}
	})

	test('return command response', async (assert) => {
		class Foo extends BaseCommand {
			public static commandName = 'foo'
			public async run() {
				return 'foo'
			}
		}

		const app = setupApp()
		const kernel = new Kernel(app)
		kernel.register([Foo])

		const response = await kernel.exec('foo', [])
		assert.equal(response, 'foo')
	})
})

test.group('Kernel | IoC container', () => {
	test('make command instance by injecting dependencies', async (assert) => {
		assert.plan(1)

		const app = setupApp()
		const kernel = new Kernel(app)

		class Foo {}
		app.container.bind('App/Foo', () => {
			return new Foo()
		})

		class Install extends BaseCommand {
			public static commandName = 'install'

			public static get inject() {
				return {
					instance: [null, null, Foo],
				}
			}

			constructor(public application: Application, public _kernel, public foo: Foo) {
				super(application, _kernel)
			}

			public async run() {
				assert.instanceOf(this.foo, Foo)
			}
		}

		kernel.register([Install])
		await kernel.handle(['install'])
	})

	test('inject dependencies to command methods', async (assert) => {
		assert.plan(1)

		const app = setupApp()
		const kernel = new Kernel(app)

		class Foo {}
		app.container.bind('App/Foo', () => {
			return new Foo()
		})

		class Install extends BaseCommand {
			public static commandName = 'install'

			public static get inject() {
				return {
					run: [Foo],
				}
			}

			public async run(foo: Foo) {
				assert.instanceOf(foo, Foo)
			}
		}

		kernel.register([Install])
		await kernel.handle(['install'])
	})
})

test.group('Kernel | defaultCommand', () => {
	test('set custom default command', async (assert) => {
		assert.plan(1)

		class Help extends BaseCommand {
			public static commandName = 'help'
			public async run() {
				assert.isTrue(true)
			}
		}

		const app = setupApp()
		const kernel = new Kernel(app)
		kernel.defaultCommand = Help
		await kernel.handle([])
	})

	test('execute before after hooks for the default command', async (assert) => {
		assert.plan(3)

		class Help extends BaseCommand {
			public static commandName = 'help'
			public async run() {
				assert.isTrue(true)
			}
		}

		const app = setupApp()
		const kernel = new Kernel(app)

		kernel.before('run', () => {
			assert.isTrue(true)
		})

		kernel.after('run', () => {
			assert.isTrue(true)
		})

		kernel.defaultCommand = Help
		await kernel.handle([])
	})
})
