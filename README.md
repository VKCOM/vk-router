# VK Router

Универсальный модуль навигации позволяет создать систему навигации в приложении на основе списка маршрутов в вашем приложении.

Источником истины в роутере является внутренний стек.

На данный момент модуль поддерживает только навигацию через query - параметры. 

## Установка

Используйте [npm](https://www.npmjs.com/) или [yarn](https://yarnpkg.com/) для установки.

```bash
npm install @vkontakte/router

yarn add @vkontakte/router
```

## Использование

```js
// router.js
  import { createNavigator } from '@vkontakte/router';

  // коллекция маршрутов
  const routes = [
    { name: 'home', 
      children: [ // задание дочерних маршрутов
         { name: 'contacts' },
         { name: 'profile' },
         { name: 'cabinet', modal: true },
         { name: 'profile', modal: true, updateUrl: false },
      ]
    },
    { name: 'landing', 
      // ... объекту маршрута можно задать любые свойства 
    }
  ];

  const config = {
    defaultRoute: 'home',
  }

  const router = createNavigator(routes, config);
  router.start();
  export default router;
``` 
в классовых компонентах
```js
// App.js
   import { router } from './router.js';
   import { Component } from 'react';

   class App extends Component {
     constructor() {
       // получение начального состояния навигации
       this.state = router.getState();
     }

     routerListener({ toState }) => {
       this.setState(toState);
     }

     componentDidMount(){
       this.unsubscribe = router.subscribe(this.routerListener);

     }
    
     componentWillUnmount(){
       // остановка роутера, удаление обработчиков событий
       router.stop();
       this.unsubscribe();
     }
     // ...
   }
``` 
с использованием хуков
 ```js
   import { useEffect, useState } from 'react';
   
   const App = () => {
     // получение начального состояния навигации
     const [state, setState] = useState(router.getState());
    
     const routerListener = ({ toState }) => {
       setState(toState);
     }

     useEffect(() => {
      const unsubscribe = router.subscribe(routerListener);

      return unsubscribe;
     } []);

     // ...
   }

``` 
   с использованием HOC и контекста из
```
// index.js
   import ReactDOM from 'react';
   import { Provider as Navigator } from '@vkontakte/router';
        
   ReactDOM.render(
     <Navigator config={config} routes={routes}>
      <App />
     </Navigator>
   , document.getElementById('root'));

// App.js
   import { withNavigator } from '@vkontakte/router';
   const App = ({ go, state }) => { 
     // ...
   }
   export default withNavigator(App);

```



## Объект конфигурации
| Параметр | Тип | Значение по умолчанию | Описание|
|-----------|-----|-----------------------| -----------|
| defaultRoute | string | 'default' |Задает стандартную страницу на которую осуществляется переход при старте приложения,  если в router.start() не указана начальная страница. Так же задает страницу которая помещается первой в стек навигации. Страница должна существовать в коллекции маршрутов|
| subRouteKey | string  | 'modal' | задает ключ свойства по которому будет определяться, является ли маршрут модальным окном или нет |
| preserveHash |boolean |false| если query параметры внутри хэша,  убирать ли хэш из url |
| preservePath |boolean  | true | строить путь от корня ресурса ``example.com/?``или сохранять папку в url ``example.com/folder?`` |
| fillBrowserStack | boolean |false| при старте роутера стек браузера наполняется вхождениями через pushState в соответствии с внутренним стеком роутера|
| errorLogger | function | ``(err) => { console.log(err) }`` | позволяет передать callback функцию для обработки ошибок роутера

## Наименование маршрутов
Название маршрутов должно быть уникальным. Создавать маршруты и явно задавать им позицию в дереве навигации можно следующим образом:

через children:
``js
const routes = [
    { name: 'home', 
      children: [ { name: 'contacts' } ]
    }
];
``

через указание name
```js
const routes = [
  { name: 'home' },
  { name: 'home.contacts' }
];
```

## Перемещение по стеку навигации
При старте роутер создает внутренний стек навигации и наполняет его вхождениями на страницы.
Первое вхождение - всегда ``config.defaultRoute``. При шагании назад по стеку мы упираемся в маршрут указанный как ``config.defaultRoute``.

Если стек браузера пуст, то переход назад по стеку роутера возможен только с помощью ``router.back()``;

При использовании параметра конифгурации ``config.fillBrowserStaсk``при старте роутера стек браузера наполняется вхождениями через pushState. 

Так мы можем переходить назад стрелкой браузера при изначально пустом стеке браузера (к примеру при переходе по прямой ссылке и/или под анонимным пользователем), на манер навигации в нативных приложениях.
## Обработка ссылок
По умолчанию, нажатия на все ссылки, которые относятся к ресурсу, на котором существует наше приложение,  обрабатываются внутри роутера.
## Состояние навигации
Роутер возвращает состояние в виде объекта 
```js
 {
   page: 'home', // текущая страница 
   modal: 'cabinet', // текущее модальное окно
   params: { id: '1' }, // параметры маршрута, как обязательные так и не обязательные
   meta: { // мета-информация о состоянии
     source: 'go',  
   }
   options: {} // опции переданные вместе с состоянием
 }
```
### meta
  мета-информация о состоянии
  #### source
   источник создания состояния
   - ``go`` - состояние в результате перехода на маршрут
   - ``popstate`` - переход стрелками браузера назад/вперед
   - ``default`` - начальное состояние роутера
   - ``url`` - состояние сгенерировано из явно переданного url

 ### options
     опции переданные при переходе
     replace - замена текущего состояние в стеке и в урле новым
     reload - перезагрузка страницы при переходе на роут

## Навигация
Метод ``router.go`` - основной метод навигации. Старт приложения выполняет метод ``router.start`` с указанием страницы с которой нужно начать навигацию в приложении.
## Создание 404 страницы

При переходе на переданный маршрут мы должны получить состояние, в котором как минимум будет указан page. В случае, если этого не произошло, мы можем поймать выполнить переход на 404 страницу, либо помощью ``сonfig.errorLogger`` получить и обработать соответствующую ошибку и выполнить переход на 404 страницу нашего приложения. Страница должна быть указана в коллекции маршрутов.

```js
const errorLogger = (err) => {
 if (err === ROUTER_ERROR_NOT_FOUND) {
    router.go('404');
 }
}

const config = {
  errorLogger,
 // ...
}

const router = createNavigator(config, routes);

// или 
const routerListener = ({ toState }) => {
  if (!toState.page) {
    router.go('404');
  }
};

router.subscribe(routerListener);
```

## Создание разных деревьев навигации и переключение между ними

## Управление модальными окнами
Попасть на страницу а затем на модальное окно можно сделать последовательным переходом
``router.go('home')``, ``router.go(cabinet)``;

## Методы
  
#### getHistory 
Метод получения копии внутреннего стека истории роутера

#### setActiveTree 
задание активного дерева навигации
* ``treeName`` - идентификатор активного дерева

#### addTree
Метод для добавления дерева навигации

* ``treeName`` - идентификатор дерева
* ``routes`` - коллекция объектов маршрутов

#### removeTree 
Метод для удаления дерева навигации.
* ``treeName`` - идентификатор дерева

#### buildState
Метод создания состояния на основе переданного URL в инициализированный роутер, используется для конструирования состояния роутера
* ``url`` - ссылка из которой нужно извлечь состояние
#### subscribe 
подписка на обновления состояния роутера
* ``subscriber`` - функция принимающая объекты состояния

#### unsubscribe
отписка от обновлений состояния роутера
* ``subscriber`` - функция принимающая объекты состояния

#### removeAllSubscribers 
удаление всех подписчиков на роутер

#### add 
добавление узлов в указанное дерево, по умолчанию  в текущее активное.

``routes`` - объект маршрута или массив маршрутов

#### remove 
удаление узлов из указанного дерева, по умолчанию  из текущего активного
* ``routeName``
 
#### buildUrl 
Метод создания ссылки на основе имени роута и параметров.
* ``routeName``
* ``params``

#### getActiveNodes 
Метод получения коллекции активных узлов, в порядке от корня дерева заканчивая текущим активным роутом

``routeName``
 
#### makeState 
построение состояния роутера на основе, переданного имени роута, параметров, а так же текущего активного дерева роутов
   * ``routeName`` - имя маршрута,
   * ``routeParams`` - параметры навигации,
   * ``stateSource`` - источник создания состояния, может быть ``go | popstate | default``,
  
#### go 
Основной метод навигации роутера
 routeName: string,
    * ``routeParams``
    * ``options``
    * ``done``

#### closeModal 
Метод закрытия для модальных окон. 
   * Метод закрытия для модальных окон.
   * история отматывается до активной страницы без модального окна,
   * иначе действует как ``router.back()``

#### back 
Метод навигации назад. При пустом стеке браузера переходит назад по внутреннему стеку с выполнением ``window.history.replaceState``.

  
#### start 
Метод активирует роутер, выполняет метод построение истории buildHistory, выполняют привязку основных обработчиков событий popstate и обработчика для перехвата нажатий на ссылки. Осуществляет начальный переход на актуальное состояние роутера
 
   * ``startRoute``
   * ``params``
   * ``opts``
  
#### stop 
- деактивирует роутер, удаляет обработчики событий.

#### getState 
возвращает текущее состояние роутера.

#### getPrevState
возвращает предыдущее состояние роутера.

#### isActive 
   Утилита роутера, возвращает булево значение
   является ли переданный роут с параметрами активным в данном состоянии роутера.

 * ``routeName``
 * ``routeParams`` 
 * ``strictCompare`` - строгое сравнение со всеми параметрами, по умолчанию ``true``
 * ``ignoreQueryParams`` - игнорирование необязятельных query параметров, по умолчанию ``false``

 
#### canActivate
добавляет во внутреннюю коллекцию обработчик, выполняемый при переходе на указанный роут
    * ``routeName``
    * ``routerHandler``

##  Лицензия
[MIT](https://choosealicense.com/licenses/mit/)
