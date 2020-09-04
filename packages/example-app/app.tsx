import 'reflect-metadata';
import {Application, http, HttpBadRequestError, template} from '@super-hornet/framework';
import {entity, t} from '@super-hornet/marshal';
import {Website} from './views/website';

@entity.name('HelloBody')
class HelloBody {
    @t name: string = '';
}


@http.controller()
class TestController {
    @http.GET()
    helloWorld() {
        return 'Hello 🌍';
    }

    @http.POST()
    addHello(body: HelloBody) {
        return `Hello ${body.name}`;
    }

    @http.GET('/:name')
        .throws(HttpBadRequestError, 'when name is invalid')
    getHello(name: string) {
        if (!name) throw new HttpBadRequestError('name is invalid');

        return `Hello ${name}`;
    }
}

class Database {
    async getData() {
        return 'async data arrived';
    }
}


@http.controller()
class HelloWorldController {
    @http.GET('/favicon.ico')
    nix() {
    }

    @http.GET('/simple')
    simple() {
        return <div>
            Test <strong>Yes</strong>
            <img src="lara.jpeg"/>
        </div>;
    }

    @http.GET('/')
    startPage() {
        return 'asd';
    }

    @http.GET('/product')
    async product() {
        async function loadUsers() {
            return ['Peter', 'Marc', 'Philipp'];
        }

        return <Website title="Product">
            <div>My Peter</div>
            <div>Mowla {await loadUsers()}</div>
        </Website>;
    }

    @http.GET('/about')
    about() {
        return <Website title="About">LOL</Website>;
    }
}

Application.root({
    providers: [Database],
    controllers: [HelloWorldController],
}).run();
